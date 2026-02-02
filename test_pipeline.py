import os
import sys
import base64
from src.lib.describe import ImageAnalyzer

def main():
    # check if image path is provided as argument
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        # Default to image.jpg in current directory if it exists
        image_path = "image.jpg"
    
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        print("Usage: uv run test_pipeline.py [path_to_image]")
        return

    print(f"Testing pipeline with image: {image_path}")
    
    # Initialize analyzer
    analyzer = ImageAnalyzer()
    
    # Step 1: Vision Analysis
    print("\n" + "="*50)
    print("STEP 1: Analyzing Image (Vision Model)")
    print("="*50)
    
    try:
        vision_analysis = analyzer.analyze_image_from_path(image_path)
        print("\n--- Raw Vision Output ---")
        print(vision_analysis)
    except Exception as e:
        print(f"Error during vision analysis: {e}")
        return

    # Step 2: Audio Description Generation
    print("\n" + "="*50)
    print("STEP 2: Generating Audio Descriptions (Text Model)")
    print("="*50)
    
    try:
        descriptions = analyzer.generate_audio_descriptions(vision_analysis, num_descriptions=10)
        
        print("\n--- Generated Audio Prompts ---")
        for i, desc in enumerate(descriptions, 1):
            print(f"{i}. {desc}")
            
    except Exception as e:
        print(f"Error during description generation: {e}")
        return

    print("\n" + "="*50)
    print("Test Complete!")
    print("="*50)

if __name__ == "__main__":
    main()
