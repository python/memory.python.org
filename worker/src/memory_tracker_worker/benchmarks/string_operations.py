"""Benchmark for string operations."""

def main():
    # Create a large string
    s = ''.join(str(i) for i in range(100_000))
    
    # String concatenation
    result = ''
    for i in range(1000):
        result += str(i)
    
    # String splitting and joining
    parts = s.split('0')
    joined = '1'.join(parts)
    
    # String formatting
    formatted = ''.join(f'{i:04d}' for i in range(1000))
    
    # String methods
    upper = s.upper()
    lower = s.lower()
    replaced = s.replace('0', '1')

if __name__ == '__main__':
    main() 