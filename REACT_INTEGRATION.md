# React Integration Guide

## Method 1: NPM Package (Recommended)

```bash
npm install @nipunx1999/perspective-viewer-boxplot
```

```jsx
import React, { useEffect, useRef } from 'react';
import perspective from '@finos/perspective';
import '@finos/perspective-viewer';
import '@finos/perspective-viewer-datagrid';
import '@finos/perspective-viewer-d3fc';

// Import the boxplot plugin - this registers it automatically
import '@nipunx1999/perspective-viewer-boxplot';

function BoxplotExample() {
  const viewerRef = useRef();

  useEffect(() => {
    const viewer = viewerRef.current;
    
    const data = [
      { region: 'North', sales: 25.5, profit: 18.3 },
      { region: 'South', sales: 32.1, profit: 24.7 },
      // ... more data
    ];

    const worker = perspective.worker();
    worker.table(data).then(table => {
      viewer.load(table);
      viewer.restore({
        plugin: 'boxplot',
        columns: ['region', 'sales', 'profit']
      });
    });

  }, []);

  return <perspective-viewer ref={viewerRef} />;
}
```

## Method 2: Local File Copy

If you copied the dist file locally:

### Step 1: Dependencies
Make sure you have these in your package.json:

```json
{
  "dependencies": {
    "@finos/perspective": "^3.0.0",
    "@finos/perspective-viewer": "^3.0.0", 
    "@finos/perspective-viewer-datagrid": "^3.0.0",
    "@finos/perspective-viewer-d3fc": "^3.0.0"
  }
}
```

### Step 2: Import Order Matters
```jsx
import React, { useEffect, useRef } from 'react';
import perspective from '@finos/perspective';

// Import Perspective components FIRST
import '@finos/perspective-viewer';
import '@finos/perspective-viewer-datagrid';
import '@finos/perspective-viewer-d3fc';

// Then import your local boxplot plugin
// Use the .cjs.js file for React projects to avoid ESLint errors
import './path/to/your/perspective-viewer-boxplot.cjs.js';

function MyComponent() {
  const viewerRef = useRef();

  useEffect(() => {
    // Wait for plugin to register
    setTimeout(() => {
      const viewer = viewerRef.current;
      
      const data = [
        { category: 'A', value1: 25, value2: 18 },
        { category: 'B', value1: 32, value2: 24 },
        // ... more data
      ];

      const worker = perspective.worker();
      worker.table(data).then(table => {
        viewer.load(table);
        
        // Configure boxplot after data loads
        setTimeout(() => {
          viewer.restore({
            plugin: 'boxplot',
            columns: ['category', 'value1', 'value2']
          });
        }, 100);
      });
    }, 500);

  }, []);

  return <perspective-viewer ref={viewerRef} />;
}
```

## Common Issues & Solutions

### Error: "Plugin not found"
- Make sure to import Perspective components before the boxplot plugin
- Add delays for plugin registration
- Check console for plugin registration messages

### Error: "d3 is not defined"  
d3 is now bundled with the plugin, so you don't need to import it separately.

### Error: Module resolution issues
- Use the npm package instead of copying files
- Ensure all peer dependencies are installed
- Check webpack externals configuration

### Plugin doesn't appear in dropdown
```jsx
// Debug available plugins
console.log(await viewer.getAvailablePlugins());
```

## Working Example

```jsx
import React, { useEffect, useRef } from 'react';
import perspective from '@finos/perspective';
import '@finos/perspective-viewer';
import '@finos/perspective-viewer-datagrid';
import '@finos/perspective-viewer-d3fc';
import '@nipunx1999/perspective-viewer-boxplot';

export default function BoxplotDemo() {
  const viewerRef = useRef();

  useEffect(() => {
    const initializeViewer = async () => {
      const viewer = viewerRef.current;
      
      // Sample data
      const data = Array.from({ length: 500 }, (_, i) => ({
        region: ['North', 'South', 'East', 'West'][i % 4],
        department: ['Sales', 'Marketing', 'Engineering'][i % 3],
        revenue: Math.random() * 100 + 20,
        profit: Math.random() * 50 + 10
      }));

      try {
        const worker = perspective.worker();
        const table = await worker.table(data);
        await viewer.load(table);
        
        await viewer.restore({
          plugin: 'boxplot',
          columns: ['region', 'revenue', 'profit']
        });
        
        console.log('Boxplot loaded successfully!');
      } catch (error) {
        console.error('Error loading boxplot:', error);
      }
    };

    initializeViewer();
  }, []);

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <perspective-viewer ref={viewerRef} />
    </div>
  );
}
```