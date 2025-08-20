# Data Explorer with Zoom Functionality - Iteration 5

This iteration adds zoom capabilities to the original data explorer, allowing users to zoom in on any canvas using mouse position and wheel interactions.

## New Features

- **Canvas Zoom**: Each chart canvas now supports zooming in/out
- **Mouse Wheel Zoom**: Use mouse wheel to zoom in/out centered on mouse position
- **Zoom Reset**: Right-click to reset zoom level
- **Pan Support**: Click and drag to pan when zoomed in
- **Zoom Indicators**: Visual feedback showing current zoom level
- **Performance Optimized**: Zoom operations are optimized for large datasets

## Zoom Controls

- **Mouse Wheel**: Zoom in/out centered on mouse position
- **Right Click**: Reset zoom to original level
- **Click + Drag**: Pan around when zoomed in
- **Zoom Level Display**: Shows current zoom factor in top-right of each panel

## Technical Implementation

- Added zoom transformation matrices to each chart
- Implemented mouse wheel event handling with zoom centering
- Added pan functionality for navigation when zoomed
- Optimized rendering to maintain performance with zoom transformations
- Preserved all existing filtering and selection functionality

## Usage

1. Open the HTML file in a modern browser
2. Wait for the 10M row dataset to load
3. Use mouse wheel over any chart to zoom in/out
4. Right-click to reset zoom
5. Click and drag to pan when zoomed in
6. All existing filtering and selection features work with zoom

## Files

- `data_explorer_zoom.html` - Main application with zoom functionality
