package media

import (
	"bytes"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"strings"
)

// ImageProcessor handles image processing operations
type ImageProcessor struct {
	maxWidth  int
	maxHeight int
	quality   int
}

// NewImageProcessor creates a new image processor
func NewImageProcessor(maxWidth, maxHeight, quality int) *ImageProcessor {
	return &ImageProcessor{
		maxWidth:  maxWidth,
		maxHeight: maxHeight,
		quality:   quality,
	}
}

// DefaultImageProcessor returns a default image processor
func DefaultImageProcessor() *ImageProcessor {
	return &ImageProcessor{
		maxWidth:  1920,
		maxHeight: 1080,
		quality:   85,
	}
}

// ProcessImage processes an image based on its MIME type
func (ip *ImageProcessor) ProcessImage(content []byte, mimeType string) ([]byte, error) {
	if !ip.isImageMIME(mimeType) {
		// Not an image, return as-is
		return content, nil
	}

	// Decode image
	img, format, err := image.Decode(bytes.NewReader(content))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Check if resizing is needed
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width <= ip.maxWidth && height <= ip.maxHeight {
		// No resizing needed, but we might want to optimize quality
		return ip.optimizeImage(content, format)
	}

	// Calculate new dimensions maintaining aspect ratio
	newWidth, newHeight := ip.calculateNewDimensions(width, height)

	// Resize image
	resizedImg := ip.resizeImage(img, newWidth, newHeight)

	// Encode resized image
	return ip.encodeImage(resizedImg, format)
}

// GetImageDimensions returns the dimensions of an image
func (ip *ImageProcessor) GetImageDimensions(content []byte) (int, int, error) {
	img, _, err := image.Decode(bytes.NewReader(content))
	if err != nil {
		return 0, 0, fmt.Errorf("failed to decode image: %w", err)
	}

	bounds := img.Bounds()
	return bounds.Dx(), bounds.Dy(), nil
}

// isImageMIME checks if the MIME type is an image
func (ip *ImageProcessor) isImageMIME(mimeType string) bool {
	return strings.HasPrefix(mimeType, "image/")
}

// calculateNewDimensions calculates new dimensions maintaining aspect ratio
func (ip *ImageProcessor) calculateNewDimensions(width, height int) (int, int) {
	aspectRatio := float64(width) / float64(height)

	newWidth := ip.maxWidth
	newHeight := int(float64(newWidth) / aspectRatio)

	if newHeight > ip.maxHeight {
		newHeight = ip.maxHeight
		newWidth = int(float64(newHeight) * aspectRatio)
	}

	return newWidth, newHeight
}

// resizeImage resizes an image using simple nearest neighbor algorithm
// Note: For production, consider using a more sophisticated library like imaging
func (ip *ImageProcessor) resizeImage(src image.Image, width, height int) image.Image {
	srcBounds := src.Bounds()
	srcWidth := srcBounds.Dx()
	srcHeight := srcBounds.Dy()

	dst := image.NewRGBA(image.Rect(0, 0, width, height))

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			srcX := x * srcWidth / width
			srcY := y * srcHeight / height
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}

	return dst
}

// encodeImage encodes an image in the specified format
func (ip *ImageProcessor) encodeImage(img image.Image, format string) ([]byte, error) {
	var buf bytes.Buffer

	switch format {
	case "jpeg":
		err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: ip.quality})
		if err != nil {
			return nil, fmt.Errorf("failed to encode JPEG: %w", err)
		}
	case "png":
		err := png.Encode(&buf, img)
		if err != nil {
			return nil, fmt.Errorf("failed to encode PNG: %w", err)
		}
	case "gif":
		err := gif.Encode(&buf, img, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to encode GIF: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported image format: %s", format)
	}

	return buf.Bytes(), nil
}

// optimizeImage optimizes an image without resizing
func (ip *ImageProcessor) optimizeImage(content []byte, format string) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(content))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	return ip.encodeImage(img, format)
}