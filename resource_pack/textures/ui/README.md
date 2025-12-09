# IC2 Bedrock GUI Textures

This folder contains texture definitions for the IndustrialCraft 2 Bedrock Edition GUI system.

## Texture Files Required

The following PNG files need to be created based on the JSON definitions:

### Energy Bars
| File | Size | Description |
|------|------|-------------|
| `energy_bar_empty.png` | 64x16 | Dark gray background bar |
| `energy_bar_full.png` | 64x16 | Yellow/orange gradient fill |
| `energy_bar_segments.png` | 80x16 | 20-segment bar (4px each) |

### Progress Arrows
| File | Size | Description |
|------|------|-------------|
| `progress_arrow_empty.png` | 24x16 | Gray arrow outline |
| `progress_arrow_full.png` | 24x16 | White filled arrow |
| `progress_arrow_animated.png` | 24x176 | 11-frame animation strip |

### Slot Backgrounds
| File | Size | Description |
|------|------|-------------|
| `slot_input.png` | 18x18 | Green-tinted input slot |
| `slot_output.png` | 26x26 | Orange-tinted output slot |
| `slot_fuel.png` | 18x18 | Red-tinted fuel slot |
| `slot_battery.png` | 18x18 | Blue-tinted battery slot |
| `slot_reactor.png` | 18x18 | Dark reactor grid slot |

## Color Palette

```
EU Energy:      #ffcc00 (yellow-orange)
Heat Safe:      #55ff55 (green)
Heat Warning:   #ffff55 (yellow)
Heat Danger:    #ff9900 (orange)
Heat Critical:  #ff5555 (red)
Slot Input:     #55aa55 (green)
Slot Output:    #ffaa00 (orange)
Slot Fuel:      #ff5555 (red)
Slot Battery:   #5555ff (blue)
```

## Design Guidelines

1. **Energy Bars**: Use horizontal gradient from left (darker) to right (lighter)
2. **Progress Arrows**: Point right, fill from left to right
3. **Slots**: Use Minecraft-style 3D beveled borders
4. **Transparency**: All textures should support alpha channel

## Current Implementation

The GUIManager uses text-based UI with ActionFormData, displaying:
- `█` for filled energy segments
- `░` for empty segments
- `▶` for completed progress
- `▷` for remaining progress

These textures are for future custom UI implementation using Bedrock's UI JSON system.
