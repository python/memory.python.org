"""Benchmark for list operations."""

def main():
    # Create a large list
    lst = []
    for i in range(1_000_000):
        lst.append(i)
    
    # List comprehension
    squares = [x * x for x in lst]
    
    # List filtering
    evens = [x for x in lst if x % 2 == 0]
    
    # List sorting
    lst.sort()
    
    # List slicing
    middle = lst[len(lst)//2:len(lst)//2 + 1000]

if __name__ == '__main__':
    main() 