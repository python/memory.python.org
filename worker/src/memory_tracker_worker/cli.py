"""Main CLI entry point."""
import sys
from .args import parse_args


def main():
    """Main entry point for the CLI."""
    args = parse_args()
    
    # Check if a command was provided
    if not hasattr(args, 'func'):
        print("Error: No command specified. Use --help for usage information.")
        sys.exit(1)
    
    # Execute the command function
    args.func(args)


if __name__ == '__main__':
    main()