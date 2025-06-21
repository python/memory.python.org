"""Benchmark for dictionary operations."""

def main():
    # Create a large dictionary
    d = {}
    for i in range(1_000_000):
        d[i] = i * i
    
    # Dictionary comprehension
    squares = {k: v * v for k, v in d.items()}
    
    # Dictionary filtering
    evens = {k: v for k, v in d.items() if k % 2 == 0}
    
    # Dictionary updates
    d.update({i: i * 2 for i in range(1000)})
    
    # Dictionary lookups
    for i in range(1000):
        _ = d.get(i, 0)

if __name__ == '__main__':
    main() 