#!/usr/bin/env python3.7
# This file runs on Debian Buster and needs to be Python 3.7 compatible.

from __future__ import annotations
from typing import Callable, Coroutine, TYPE_CHECKING
from types import FrameType

import asyncio
import asyncio.subprocess
import dataclasses
import shutil
import signal
import sys


if TYPE_CHECKING:
    # a coroutine function that doesn't accept arguments and whose coroutine doesn't
    # return anything
    SimpleCoroutineFunction = Callable[[], Coroutine[None, None, None]]


async def gracefully_close(proc: asyncio.subprocess.Process, cmdline: str) -> int:
    prefix = make_prefix(cmdline)
    prefix_e = make_prefix(cmdline, err=True)
    if proc.returncode is not None:
        print(
            f"{prefix}PID {proc.pid} exited with status code {proc.returncode}",
            flush=True,
        )
        return proc.returncode

    print(f"{prefix}Asking PID {proc.pid} to terminate...", flush=True)
    proc.terminate()
    try:
        await asyncio.wait_for(proc.wait(), timeout=10.0)
        if proc.returncode is not None:
            print(f"{prefix}PID {proc.pid} successfully terminated", flush=True)
            return proc.returncode
    except BaseException:
        pass

    print(f"{prefix_e}Killing PID {proc.pid} forcefully...", flush=True)
    proc.kill()
    try:
        await asyncio.wait_for(proc.wait(), timeout=2.0)
        if proc.returncode is not None:
            print(f"{prefix_e}PID {proc.pid} successfully killed", flush=True)
            return proc.returncode
    except BaseException:
        pass

    return -1024


def make_prefix(
    cmdline: str, out: bool = False, err: bool = False, maxlength: int = 24
) -> str:
    if len(cmdline) > maxlength:
        cmdline = cmdline[: maxlength - 1] + "…"
    kind = "  "
    if out:
        kind = " →"
    elif err:
        kind = "!!"
    padding = " " * (maxlength - len(cmdline))
    return f"{cmdline}{padding}  {kind} "


def censor(s: str) -> str:
    if s.startswith("--backend-dsn="):
        return "--backend-dsn=********"
    if s.startswith("--dsn="):
        return "--dsn=********"
    return s


@dataclasses.dataclass(init=False)
class Minivisor:
    """A tiny process supervisor.

    It only gathers output from subprocesses and closes all if any of them dies.
    It passes SIGHUP, SIGINT, and SIGTERM but it doesn't multiplex sockets or do
    anything else fancy.
    """

    processes: dict[str, asyncio.subprocess.Process]
    waiters: list[asyncio.Task[int]]
    followers: list[asyncio.Task[None]]
    out: asyncio.Queue[bytes]
    display: asyncio.Task[None]

    def __init__(self):
        self.processes = {}
        self.waiters = []
        self.followers = []
        self.out = asyncio.Queue()
        self.display = asyncio.create_task(self.display_out())
        self._is_shutting_down = False

        loop = asyncio.get_event_loop()
        loop.add_signal_handler(signal.SIGHUP, self.signal_passer)
        loop.add_signal_handler(signal.SIGINT, self.signal_passer)
        loop.add_signal_handler(signal.SIGTERM, self.signal_passer)

    def signal_passer(self, sig: int = 0, frame: FrameType | None = None) -> None:
        if not sig:
            return

        for proc in reversed(self.processes):
            proc.send_signal(sig)

    async def spawn(
        self,
        *args: str,
        with_healthcheck: SimpleCoroutineFunction | None = None,
        grace_period: float = 10.0,
        sleep_period: float = 60.0,
    ) -> None:
        """Spawn a new process with `exec` and wait for initial healthcheck to pass."""

        exe = shutil.which(args[0])
        if not exe:
            raise RuntimeError(f"Missing {args[0]} executable")

        cmdline = " ".join(censor(a) for a in args)
        prefix_str = make_prefix(cmdline)
        prefix_out = make_prefix(cmdline, out=True).encode()
        prefix_err = make_prefix(cmdline, err=True).encode()
        proc = await asyncio.create_subprocess_exec(
            exe,
            *args[1:],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await self.out.put(
            f"{prefix_str}PID {proc.pid} spawned daemon '{cmdline}'".encode("utf8")
        )
        initial_pass = asyncio.Future()
        waiter_task = asyncio.create_task(
            self.check_health(
                proc,
                cmdline,
                with_healthcheck or empty_healthcheck,
                initial_pass=initial_pass,
                grace_period=grace_period,
                sleep_period=sleep_period,
            )
        )
        stdout_task = asyncio.create_task(self.follow(prefix_out, proc.stdout))
        stderr_task = asyncio.create_task(self.follow(prefix_err, proc.stderr))
        self.processes[cmdline] = proc
        self.waiters.append(waiter_task)
        self.followers.append(stdout_task)
        self.followers.append(stderr_task)
        if not await initial_pass:
            # Healthchecks are not optional.
            await self.out.put(
                prefix_err + b"Initial health check failed, shutting down."
            )
            await self.shutdown()
            raise RuntimeError("Cannot continue without all processes healthy")
        else:
            await self.out.put(
                prefix_str.encode("utf8") + b"Initial health check passed."
            )

    async def once(
        self,
        *args: str,
        input: bytes | None = None,
        require_clean_return_code: bool = True,
    ) -> int:
        """Spawn a short-lived process."""

        exe = shutil.which(args[0])
        if not exe:
            raise RuntimeError(f"Missing {args[0]} executable")

        cmdline = " ".join(censor(a) for a in args)
        prefix_str = make_prefix(cmdline)
        prefix_out = make_prefix(cmdline, out=True).encode()
        prefix_err = make_prefix(cmdline, err=True).encode()
        proc = await asyncio.create_subprocess_exec(
            exe,
            *args[1:],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE,
        )
        await self.out.put(
            f"{prefix_str}PID {proc.pid} running command '{cmdline}'".encode("utf8")
        )
        stdout_task = asyncio.create_task(self.follow(prefix_out, proc.stdout))
        stderr_task = asyncio.create_task(self.follow(prefix_err, proc.stderr))
        try:
            try:
                if input is not None:
                    proc.stdin.write(input)
                    try:
                        await proc.stdin.drain()
                    except (BrokenPipeError, ConnectionResetError):
                        pass
                proc.stdin.close()

                await proc.wait()
            finally:
                return_code = await gracefully_close(proc, cmdline)
                stdout_task.cancel()
                stderr_task.cancel()
                await asyncio.wait([stdout_task, stderr_task], timeout=2.0)
        finally:
            if not require_clean_return_code or return_code == 0:
                return return_code  # continue, even if the world is burning

            await self.out.put(
                prefix_err + b"Return code isn't zero: " + f"{return_code}".encode()
            )
            await self.shutdown()
            raise RuntimeError("Cannot continue without this command succeeding")

    async def wait_until_any_terminates(self) -> None:
        if self._is_shutting_down:
            return

        try:
            await asyncio.wait(self.waiters, return_when=asyncio.FIRST_COMPLETED)
        finally:
            await self.shutdown()

    async def display_out(self) -> None:
        while True:
            line = await self.out.get()
            if line[-1] != b"\n":
                line += b"\n"
            sys.stdout.buffer.write(line)
            sys.stdout.flush()

    async def follow(self, prefix: bytes, s: asyncio.StreamReader) -> None:
        """Generates lines."""
        accu = prefix
        while not s.at_eof():
            try:
                line = await asyncio.wait_for(s.readuntil(b"\n"), timeout=1.0)
                for li in line.splitlines():
                    if li.strip():
                        await self.out.put(accu + li)
                        accu = prefix
            except asyncio.LimitOverrunError:
                # a lot of characters without a newline; let's just accumulate them
                accu += await s.read(2 ** 16)
            except asyncio.TimeoutError:
                # no data coming or no \n; wait a bit longer
                continue
            except asyncio.IncompleteReadError as ire:
                # reached EOF without a newline; let's display what we got and exit
                if ire.partial:
                    await self.out.put(accu + ire.partial)
                return
            except asyncio.CancelledError:
                # follow() is being cancelled, let's flush what we got so far
                if accu != prefix:
                    try:
                        self.out.put_nowait(accu)
                    except asyncio.QueueFull:
                        pass
                raise

    async def shutdown(self) -> None:
        if self._is_shutting_down:
            return

        self._is_shutting_down = True
        for waiter in self.waiters:
            # Sic, cancel all waiters, including possibly done ones, because
            # in this `finally:` block we might be in the middle of an exception.
            waiter.cancel()
        for cmdline, proc in reversed(list(self.processes.items())):
            # Sic, serially close in reverse order.
            await gracefully_close(proc, cmdline=cmdline)

        # At this point all followers should be finished but let's ensure that.
        if self.followers:
            for follower in self.followers:
                follower.cancel()
            await asyncio.wait(self.followers, timeout=2.0)

        # Finally we can close our output queue display.
        self.display.cancel()
        await asyncio.wait([self.display], timeout=2.0)

    async def is_unhealthy(
        self,
        proc: asyncio.subprocess.Process,
        cmdline: str,
        hc: SimpleCoroutineFunction,
    ) -> bool:
        """Return True if healthcheck failed."""

        prefix = make_prefix(cmdline, err=True)
        failed = False
        try:
            await hc()
        except Exception as exc:
            failed = True
            for line in str(exc).splitlines():
                if line.strip():
                    line = "Health: " + prefix + line
                    await self.out.put(line.encode())
        return failed or proc.returncode is not None

    async def check_health(
        self,
        proc: asyncio.subprocess.Process,
        cmdline: str,
        hc: SimpleCoroutineFunction,
        grace_period: float = 10.0,
        sleep_period: float = 60.0,
        initial_pass: asyncio.Future | None = None,
    ) -> None:
        failures = 0
        await asyncio.sleep(grace_period)
        while True:
            if await self.is_unhealthy(proc, cmdline, hc):
                failures += 1
            else:
                if initial_pass is not None:
                    initial_pass.set_result(True)
                    initial_pass = None
                failures = 0
            if failures == 3:
                await gracefully_close(proc, cmdline)
                if initial_pass is not None:
                    initial_pass.set_result(False)
                    initial_pass = None
                return
            try:
                sleep_sec = sleep_period if initial_pass is None else grace_period
                await asyncio.wait_for(proc.wait(), timeout=sleep_sec)
                if initial_pass is not None:
                    initial_pass.set_result(False)
                    initial_pass = None
                return
            except asyncio.TimeoutError:
                continue


async def empty_healthcheck() -> None:
    return


async def selftest() -> None:
    i = 0
    async def _failing_recovering_healthcheck():
        nonlocal i
        await asyncio.sleep(2.0)
        if i % 3 == 0:
            i += 1
            raise RuntimeError("healthcheck failed synthetically")
        i += 1

    mv = Minivisor()
    await mv.spawn("tail", "-F", "/var/log/system.log")
    await mv.spawn(
        "python3", "-u", "-m", "http.server", with_healthcheck=_failing_recovering_healthcheck
    )
    await mv.spawn("tail", "-F", "/var/log/syslog")
    await mv.wait_until_any_terminates()


if __name__ == "__main__":
    asyncio.run(selftest())
