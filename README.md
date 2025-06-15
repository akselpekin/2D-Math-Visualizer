# 2D Math Visualizer

A browser-based interactive 2D graphing tool built with HTML5 Canvas and JavaScript. Visualize mathematical functions, parametric curves, and polygons in real-time.

## Live application

View the live application on GitHub Pages: https://akselpekin.github.io/2D-Math-Visualizer/

## Features

- **Pan & Zoom**: Drag to pan, scroll or use slider to zoom.
- **Grid & Axes**: Toggle display of grid lines and numeric labels.
- **Explicit Curves**: Plot functions of the form `y = f(x)`.
- **Parametric Curves**: Define `x(t)` and `y(t)` separated by `|`.
- **Polygons**: Draw shapes with `poly(x1,y1,x2,y2,...)` syntax.
- **Style Controls**: Customize stroke color, line width, fill color, and opacity.
- **Error Handling**: Inline parsing errors flagged with specific messages.
- **Export to PNG**: Capture both the graph and formula pane as a PNG.

## Syntax Guide

Enter one or more objects using the following block syntax:
```
@{ expression ; stroke=#RRGGBB ; width=N ; [fill=#RRGGBB] ; [alpha=0-1] }
```
- **expression**: 
  - Explicit: `y = x^2`  
  - Parametric: `x(t)=5*cos(t) | y(t)=5*sin(t)`  
  - Polygon: `poly(x1,y1,x2,y2,...)`  
- **stroke**: Hex color for line (`#RRGGBB`).
- **width**: Line thickness (positive number).
- **fill** *(optional)*: Hex fill color.
- **alpha** *(optional)*: Opacity from `0` to `1`.

Multiple objects can be specified in separate @{} blocks.

## Dependencies

- [math.js](https://mathjs.org/) for expression parsing and evaluation.
- [html2canvas](https://html2canvas.hertzen.com/) for full-page export.

## License

Consult the "LICENSE" file.