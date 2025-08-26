# Perspective Viewer Boxplot

A seaborn-style boxplot plugin for [FINOS Perspective](https://perspective.finos.org) with rich hover tooltips and multi-metric support.

## Features

✅ **Generic categorical grouping** - Works with any column names  
✅ **Multi-metric support** - Compare multiple metrics side-by-side  
✅ **Rich hover tooltips** - Detailed statistics on hover  
✅ **Proper statistics** - Uses individual data points, not aggregated data  
✅ **Seaborn-style** - Familiar boxplot visualization  
✅ **React compatible** - Easy integration with React apps  

## Installation

```bash
npm install @nipunx1999/perspective-viewer-boxplot
```

## Usage

### Basic React Setup

```jsx
import React, { useEffect, useRef } from 'react';
import perspective from '@finos/perspective';
import '@finos/perspective-viewer';
import '@finos/perspective-viewer-datagrid';
import '@finos/perspective-viewer-d3fc';

// Import the boxplot plugin
import '@nipunx1999/perspective-viewer-boxplot';

function MyComponent() {
  const viewerRef = useRef();

  useEffect(() => {
    const viewer = viewerRef.current;
    
    // Sample data with any categorical column names
    const data = [
      { region: 'North', revenue: 25.5, profit: 18.3 },
      { region: 'South', revenue: 32.1, profit: 24.7 },
      { region: 'East', revenue: 28.9, profit: 21.2 },
      // ... more data
    ];

    // Create table and load data
    const worker = perspective.worker();
    const table = worker.table(data);
    viewer.load(table);

    // Configure boxplot
    viewer.restore({
      plugin: 'boxplot',
      columns: ['region', 'revenue', 'profit'], // categorical + metrics
      // OR with explicit grouping:
      // group_by: ['region'],
      // columns: ['revenue', 'profit']
    });

  }, []);

  return <perspective-viewer ref={viewerRef} />;
}
```

### Configuration Options

#### Automatic Grouping (Recommended)
```javascript
// Plugin detects 'region' as categorical and uses it for x-axis
columns: ['region', 'revenue', 'profit']
```

#### Explicit Grouping
```javascript
group_by: ['category_column'],
columns: ['revenue', 'profit']
```

#### Multiple Metrics
```javascript
// Shows side-by-side boxplots for each metric
columns: ['department', 'sales', 'expenses', 'profit']
```

### Data Format

The plugin works with any tabular data:

```javascript
const data = [
  { 
    category: 'A',        // Any categorical column name
    sales: 25.5,          // Any numeric column name
    profit: 18.3,
    other_col: 'ignore'   // Non-selected columns are ignored
  },
  // ... more rows
];
```

## Grouping Strategies

The plugin uses a smart 4-strategy approach:

1. **`group_by` config** - Use Perspective's standard group_by
2. **Single categorical** - Auto-detect if only one categorical column
3. **Multiple categorical** - Warning + default to first one
4. **No categorical** - Show metrics side-by-side

## Features

### Rich Hover Tooltips
Hover over any box to see:
- Count, Min, Q1, Median, Q3, Max, Mean
- Number of outliers
- Group and metric names

### Visual Feedback  
- Box highlighting on hover
- Smooth animations
- Color-coded legend for multiple metrics

### Statistical Accuracy
- Uses individual data points (not aggregated)  
- Proper quartile calculations
- Outlier detection (1.5 × IQR rule)

## Browser Support

- Modern browsers with ES6 support
- WebGL for optimal Perspective performance

## Development

```bash
git clone https://github.com/nipunx1999/perspective-viewer-boxplot
cd perspective-viewer-boxplot
npm install
npm run build    # Production build
npm run dev      # Development with watch
npm run start    # Development server
```

## License

Apache-2.0

## Contributing

Issues and PRs welcome on [GitHub](https://github.com/yourusername/perspective-viewer-boxplot)!