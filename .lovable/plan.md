

# Add Pie Chart Widget to Chat

## What This Does
Adds a new `pie-chart` widget type to the analytics chat, so when the AI returns distribution data (e.g., "60% mobile, 30% desktop, 10% tablet"), it renders as a visual pie chart instead of plain text.

## How It Works
The AI wraps distribution data in a ` ```pie-chart ` code block with JSON like:
```json
{
  "title": "Traffic by Device",
  "slices": [
    { "label": "Mobile", "value": 60 },
    { "label": "Desktop", "value": 30 },
    { "label": "Tablet", "value": 10 }
  ]
}
```

This renders as a donut-style pie chart with a legend, using the same card styling as the existing funnel and metrics widgets.

## Technical Changes

### 1. `src/components/chat/ChatWidgets.tsx`
- Add a `PieChartWidget` component that:
  - Parses the JSON for `slices` (array of `{ label, value }`)
  - Renders a Recharts `PieChart` with `Pie`, `Cell`, `Tooltip`, and `Legend`
  - Uses a predefined color palette (primary, blue, green, orange, purple, pink, etc.)
  - Wrapped in a `Card` matching existing widget styling
  - Shows optional `title` above the chart
- Update the `widgetRegex` to include `pie-chart`:
  ```
  /```(funnel|metrics|top-events|pie-chart)\n([\s\S]*?)```/g
  ```
- Export the new component

### 2. `src/components/chat/ChatMessageContent.tsx`
- Add a `case "pie-chart"` to the widget switch statement that renders `<PieChartWidget>`

### 3. AI Prompt Update (optional, later)
- Update the `analytics-chat` edge function system prompt to mention the new ` ```pie-chart ` format for distribution data -- this can be done separately.

## Visual Design
- Donut chart (inner radius ~60%) inside a Card, same border style as funnel widget
- Color-coded legend below the chart showing label + value + percentage
- Compact height (~200px) to fit naturally in chat flow
