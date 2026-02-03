try:
    import transformers
    import scipy
    print("Imports successful")
except ImportError as e:
    print(f"Import failed: {e}")
