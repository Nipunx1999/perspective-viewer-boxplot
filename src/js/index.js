import * as d3 from 'd3';

async function loadPerspectiveBoxplotPlugin() {
    // Wait for perspective-viewer to be fully loaded
    while (!window.customElements.get("perspective-viewer-plugin")) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    class BoxplotPlugin extends window.customElements.get("perspective-viewer-plugin") {
        constructor() {
            super();
            this._container = null;
            this._chart = null;
        }

        get name() {
            return "Boxplot";
        }

        get selectMode() {
            return "select";
        }

        get min_config_columns() {
            return 1;
        }

        get config_column_names() {
            return ["Value"];
        }

        get priority() {
            return 1;
        }

        async draw(view) {
            if (!this._container) {
                this._container = document.createElement("div");
                this._container.style.width = "100%";
                this._container.style.height = "100%";
                this._container.style.position = "relative";
                this._container.style.overflow = "hidden";
                this.appendChild(this._container);
            }

            try {
                // Get view configuration and schema
                const config = await view.get_config();
                const schema = await view.schema();

                // For boxplots, we need raw data, not aggregated data
                // So we'll get the data without group_by/split_by to avoid aggregation
                const rawData = await this._getRawDataForBoxplot(view, config);


                // Render the boxplot using bundled d3
                await this._renderBoxplot(rawData, config, schema);
            } catch (error) {
                console.error("Error rendering boxplot:", error);
                this._container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Error rendering chart: ${error.message}</div>`;
            }
        }

        async _getRawDataForBoxplot(view, config) {
            try {
                // For Perspective viewer plugins, try different approaches to get the table
                let table = null;
                
                // Try to access the table through different paths
                if (view.table) {

                    table = view.table;
                } else if (view._table) {

                    table = view._table;
                } else if (this._view && this._view.table) {
                    table = this._view.table;
                } else if (this.parentElement && this.parentElement.table) {
                    table = this.parentElement.table;
                }

                if (!table) {
                    console.warn('Could not access table directly, using current view data');
                    const currentData = await view.to_json();

                    return currentData;
                }


                // Create a configuration that gets ALL raw data
                const rawConfig = {
                    // Don't specify columns to get all columns
                    group_by: [], // No grouping
                    split_by: [], // No splitting  
                    aggregates: {}, // No aggregation
                    sort: [], // No sorting
                    filter: config.filter || [] // Keep any existing filters
                };


                // Create a temporary view to get raw data
                const tempView = await table.view(rawConfig);
                const rawData = await tempView.to_json();

                
                await tempView.delete(); // Clean up

                return rawData;
            } catch (error) {

                const fallbackData = await view.to_json();

                return fallbackData;
            }
        }

        async _renderBoxplot(data, config, schema) {
            // Use bundled d3 (imported at top of file)
            // Clear previous content
            this._container.innerHTML = '';

            // Get container dimensions
            const containerRect = this._container.getBoundingClientRect();
            const width = Math.max(400, containerRect.width || 600);
            const height = Math.max(300, containerRect.height || 400);
            const margin = { top: 20, right: 30, bottom: 50, left: 60 };

            // Process data for boxplot
            const processedData = this._processDataForBoxplot(data, config, schema);

            if (!processedData || processedData.length === 0) {
                this._container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">No numeric data available for boxplot</div>';
                return;
            }


            // Create SVG using bundled d3
            const svg = d3.select(this._container)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .style('background', '#fff')
                .style('border', '1px solid #ddd');

            // Calculate scales
            const allValues = processedData.flatMap(d => [
                d.stats.min,
                d.stats.max,
                ...d.stats.outliers
            ]);

            const yDomain = d3.extent(allValues);
            const yRange = yDomain[1] - yDomain[0];
            const yPadding = yRange * 0.05;

            // X-axis uses the unique group keys (like size_bucket values)
            const uniqueGroups = [...new Set(processedData.map(d => d.groupKey))];
            const xScale = d3.scaleBand()
                .domain(uniqueGroups)
                .range([margin.left, width - margin.right])
                .padding(0.2);

            const yScale = d3.scaleLinear()
                .domain([yDomain[0] - yPadding, yDomain[1] + yPadding])
                .range([height - margin.bottom, margin.top]);

            const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

            // Draw axes
            this._drawAxes(svg, xScale, yScale, { width, height, margin });

            // Draw boxplots (this also handles colors internally)
            this._drawBoxplots(svg, processedData, xScale, yScale, colorScale);

            // Add legend (debug the issue)
            console.log('Drawing legend for data:', processedData.map(d => ({metric: d.metric})));
            this._drawLegend(svg, processedData, { width, height, margin });

            // Add click handlers and hover tooltips
            this._addInteractivity(svg, processedData);
        }

        _processDataForBoxplot(data, config, schema) {
            if (!data || data.length === 0) return [];

            // Since we're getting raw data, we always process it as raw
            return this._processRawData(data, config, schema);
        }


        _processRawData(data, config, schema) {
            
            const configColumns = config.columns || [];
            
            // Separate numeric and categorical columns from config
            const numericColumns = [];
            const categoricalColumns = [];
            
            configColumns.forEach(col => {
                if (schema[col] === 'float' || schema[col] === 'integer') {
                    numericColumns.push(col);
                } else if (schema[col] === 'string') {
                    categoricalColumns.push(col);
                }
            });


            if (numericColumns.length === 0) {
                console.warn('No numeric columns found in config.columns');
                return [];
            }

            // Determine grouping column - several strategies:
            let groupByColumn = null;
            
            // Strategy 1: Use config.group_by if provided (from UI)
            if (config.group_by && config.group_by.length > 0) {
                groupByColumn = config.group_by[0];
                console.log('Using config.group_by for grouping:', groupByColumn);
            }
            // Strategy 2: If exactly one categorical column in config.columns, use it for grouping
            else if (categoricalColumns.length === 1) {
                groupByColumn = categoricalColumns[0];
                console.log('Using single categorical column for grouping:', groupByColumn);
            }
            // Strategy 3: If multiple categorical columns, let user know they need to be explicit
            else if (categoricalColumns.length > 1) {
                console.warn('Multiple categorical columns found. Consider using group_by to specify which to use for x-axis:', categoricalColumns);
                groupByColumn = categoricalColumns[0]; // Default to first one
                console.log('Defaulting to first categorical column for grouping:', groupByColumn);
            }
            // Strategy 4: No categorical columns - no grouping (single set of boxplots)
            else {
                console.log('No categorical columns found - will show metrics without grouping');
            }

            console.log('Metrics to plot:', numericColumns);

            const result = [];

            if (groupByColumn) {
                // Group data by the grouping variable (like size_bucket)
                const groups = d3.group(data, d => d[groupByColumn] || 'Unknown');

                console.log('Groups found:', Array.from(groups.keys()));

                for (const [groupKey, groupData] of groups) {
                    console.log(`Group "${groupKey}" has ${groupData.length} raw data rows`);
                    
                    // For each metric, create a separate boxplot within this group
                    numericColumns.forEach((metricCol, metricIndex) => {
                        const values = Array.from(groupData)
                            .map(d => +d[metricCol])
                            .filter(v => !isNaN(v) && v !== null && v !== undefined)
                            .sort(d3.ascending);

                        console.log(`Group "${groupKey}" - "${metricCol}" has ${values.length} values, range: ${values[0]} to ${values[values.length-1]}`);

                        if (values.length > 0) {
                            result.push({
                                label: groupKey,
                                metric: metricCol,
                                metricIndex: metricIndex,
                                groupKey: groupKey,
                                values,
                                stats: this._calculateBoxplotStats(values)
                            });
                        }
                    });
                }
            } else {
                // No grouping, show each metric as separate boxplot
                numericColumns.forEach((metricCol, metricIndex) => {
                    const values = data
                        .map(d => +d[metricCol])
                        .filter(v => !isNaN(v) && v !== null && v !== undefined)
                        .sort(d3.ascending);

                    if (values.length > 0) {
                        result.push({
                            label: metricCol,
                            metric: metricCol,
                            metricIndex: metricIndex,
                            groupKey: metricCol,
                            values,
                            stats: this._calculateBoxplotStats(values)
                        });
                    }
                });
            }

            console.log('Multi-metric boxplot result:', result.map(r => ({
                group: r.groupKey,
                metric: r.metric,
                count: r.values.length,
                median: r.stats.median
            })));

            return result;
        }

        _calculateBoxplotStats(values) {
            if (!values || values.length === 0) return null;

            const sortedValues = [...values].sort(d3.ascending);
            const n = sortedValues.length;

            const q1 = d3.quantile(sortedValues, 0.25);
            const median = d3.quantile(sortedValues, 0.5);
            const q3 = d3.quantile(sortedValues, 0.75);
            const mean = d3.mean(sortedValues);

            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;

            const min = sortedValues.find(v => v >= lowerFence) || sortedValues[0];
            const max = [...sortedValues].reverse().find(v => v <= upperFence) || sortedValues[n - 1];

            const outliers = sortedValues.filter(v => v < lowerFence || v > upperFence);

            return {
                min, max, q1, median, q3, mean, outliers, count: n
            };
        }

        _drawAxes(svg, xScale, yScale, settings) {
            const { margin, width, height } = settings;

            // Y-axis grid lines
            svg.selectAll('.grid-line')
                .data(yScale.ticks(8))
                .enter()
                .append('line')
                .attr('class', 'grid-line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yScale)
                .attr('y2', yScale)
                .attr('stroke', '#e5e7eb')
                .attr('stroke-dasharray', '2,2');

            // Y-axis labels
            svg.selectAll('.y-label')
                .data(yScale.ticks(8))
                .enter()
                .append('text')
                .attr('class', 'y-label')
                .attr('x', margin.left - 10)
                .attr('y', yScale)
                .attr('text-anchor', 'end')
                .attr('alignment-baseline', 'middle')
                .style('font-size', '12px')
                .style('fill', '#666')
                .text(d => d);

            // X-axis line
            svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', height - margin.bottom)
                .attr('y2', height - margin.bottom)
                .attr('stroke', '#374151');

            // X-axis labels
            svg.selectAll('.x-label')
                .data(xScale.domain())
                .enter()
                .append('text')
                .attr('class', 'x-label')
                .attr('x', d => xScale(d) + xScale.bandwidth() / 2)
                .attr('y', height - margin.bottom + 20)
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .style('fill', '#333')
                .text(d => d.length > 15 ? d.substring(0, 15) + '...' : d);
        }

        _drawLegend(svg, processedData, settings) {
            const { width, margin } = settings;
            
            // Show legend for metrics only
            const allMetrics = [...new Set(processedData.map(d => d.metric))];
            
            console.log('Legend - allMetrics:', allMetrics);
            console.log('Legend - processedData sample:', processedData.slice(0, 2));
            
            if (allMetrics.length <= 1) {
                console.log('Skipping legend - only one metric or less');
                return; 
            }
            
            const metricColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(allMetrics);

            // Position legend more safely within the chart area
            const legendX = width - 120; // Fixed position from right edge
            const legendY = margin.top;
            
            console.log(`Legend position: ${legendX}, ${legendY}`);

            const legendG = svg.append('g')
                .attr('class', 'legend')
                .attr('transform', `translate(${legendX}, ${legendY})`);

            // Add legend background for visibility
            const legendBg = legendG.append('rect')
                .attr('x', -5)
                .attr('y', -5)
                .attr('width', 110)
                .attr('height', allMetrics.length * 30 + 10)
                .attr('fill', 'white')
                .attr('fill-opacity', 0.9)
                .attr('stroke', '#ccc')
                .attr('stroke-width', 1)
                .attr('rx', 4);

            const legendItemHeight = 30;
            
            allMetrics.forEach((metric, i) => {
                console.log(`Creating legend item ${i}: ${metric}`);
                
                const itemG = legendG.append('g')
                    .attr('transform', `translate(0, ${i * legendItemHeight})`);

                // Color box
                itemG.append('rect')
                    .attr('x', 5)
                    .attr('y', 5)
                    .attr('width', 16)
                    .attr('height', 16)
                    .attr('fill', metricColorScale(metric))
                    .attr('fill-opacity', 0.7)
                    .attr('stroke', metricColorScale(metric))
                    .attr('stroke-width', 2);

                // Label text
                const textEl = itemG.append('text')
                    .attr('x', 28)
                    .attr('y', 16)
                    .style('font-family', 'Arial, sans-serif')
                    .style('font-size', '14px')
                    .style('fill', '#333')
                    .style('font-weight', 'bold')
                    .text(metric);
                    
                console.log(`Added text for ${metric}:`, textEl.text());
            });
            
            console.log('Legend created successfully');
        }

        _drawBoxplots(svg, processedData, xScale, yScale, colorScale) {
            console.log('Drawing multi-metric boxplots for', processedData.length, 'boxes');

            // Group data by x-axis groups first
            const groupedByX = d3.group(processedData, d => d.groupKey);
            
            // Create color scale for metrics
            const allMetrics = [...new Set(processedData.map(d => d.metric))];
            const metricColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(allMetrics);
            
            console.log('Drawing boxplots for groups:', Array.from(groupedByX.keys()));
            console.log('Metrics:', allMetrics);

            for (const [groupKey, groupData] of groupedByX) {
                const groupBaseX = xScale(groupKey);
                const groupWidth = xScale.bandwidth();
                
                // Calculate how many boxes (metrics) we have in this group
                const metricsInGroup = groupData.length;
                const boxWidth = Math.max(20, (groupWidth / metricsInGroup) - 5);
                
                console.log(`Group "${groupKey}" has ${metricsInGroup} metrics`);
                
                groupData.forEach((seriesData, metricIndex) => {
                    const { stats, metric } = seriesData;
                    
                    // Position the box within the group (side by side for different metrics)
                    const boxX = groupBaseX + (metricIndex * groupWidth / metricsInGroup);
                    const centerX = boxX + boxWidth / 2;
                    
                    // Color by metric (qlsSpread vs aggSpread)
                    const color = metricColorScale(metric);

                    console.log(`Drawing "${metric}" box for group "${groupKey}" at x=${centerX}`);

                    const g = svg.append('g')
                        .attr('class', 'boxplot-group')
                        .attr('data-group', groupKey)
                        .attr('data-metric', metric);

                    // Whiskers
                    g.append('line')
                        .attr('x1', centerX)
                        .attr('x2', centerX)
                        .attr('y1', yScale(stats.min))
                        .attr('y2', yScale(stats.q1))
                        .attr('stroke', color)
                        .attr('stroke-width', 2);

                    g.append('line')
                        .attr('x1', centerX)
                        .attr('x2', centerX)
                        .attr('y1', yScale(stats.q3))
                        .attr('y2', yScale(stats.max))
                        .attr('stroke', color)
                        .attr('stroke-width', 2);

                    // Whisker caps
                    const capWidth = boxWidth * 0.4;
                    g.append('line')
                        .attr('x1', centerX - capWidth/2)
                        .attr('x2', centerX + capWidth/2)
                        .attr('y1', yScale(stats.min))
                        .attr('y2', yScale(stats.min))
                        .attr('stroke', color)
                        .attr('stroke-width', 2);

                    g.append('line')
                        .attr('x1', centerX - capWidth/2)
                        .attr('x2', centerX + capWidth/2)
                        .attr('y1', yScale(stats.max))
                        .attr('y2', yScale(stats.max))
                        .attr('stroke', color)
                        .attr('stroke-width', 2);

                    // Box (IQR)
                    g.append('rect')
                        .attr('x', boxX)
                        .attr('y', yScale(stats.q3))
                        .attr('width', boxWidth)
                        .attr('height', yScale(stats.q1) - yScale(stats.q3))
                        .attr('fill', color)
                        .attr('fill-opacity', 0.3)
                        .attr('stroke', color)
                        .attr('stroke-width', 2);

                    // Median line
                    g.append('line')
                        .attr('x1', boxX)
                        .attr('x2', boxX + boxWidth)
                        .attr('y1', yScale(stats.median))
                        .attr('y2', yScale(stats.median))
                        .attr('stroke', '#333')
                        .attr('stroke-width', 3);

                    // Mean point
                    g.append('circle')
                        .attr('cx', centerX)
                        .attr('cy', yScale(stats.mean))
                        .attr('r', 4)
                        .attr('fill', 'white')
                        .attr('stroke', color)
                        .attr('stroke-width', 2);

                    // Outliers
                    if (stats.outliers && stats.outliers.length > 0) {
                        g.selectAll('.outlier')
                            .data(stats.outliers)
                            .enter()
                            .append('circle')
                            .attr('class', 'outlier')
                            .attr('cx', () => centerX + (Math.random() - 0.5) * boxWidth * 0.6)
                            .attr('cy', yScale)
                            .attr('r', 3)
                            .attr('fill', color)
                            .attr('fill-opacity', 0.7)
                            .attr('stroke', 'white')
                            .attr('stroke-width', 1);
                    }
                });
            }
        }

        _addInteractivity(svg, processedData) {
            const self = this;
            
            // Create tooltip div
            const tooltip = d3.select(this._container)
                .append('div')
                .style('position', 'absolute')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', 'white')
                .style('padding', '8px 12px')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('opacity', 0);

            // Add hover interactions to boxplot groups
            svg.selectAll('.boxplot-group')
                .style('cursor', 'pointer')
                .on('mouseenter', function(event, d) {
                    const group = d3.select(this);
                    const groupKey = group.attr('data-group');
                    const metric = group.attr('data-metric');
                    
                    // Find the corresponding data
                    const boxData = processedData.find(pd => 
                        pd.groupKey === groupKey && pd.metric === metric
                    );
                    
                    if (boxData) {
                        const stats = boxData.stats;
                        
                        // Show tooltip - fix positioning to be close to pointer
                        const containerRect = self._container.getBoundingClientRect();
                        const x = event.clientX - containerRect.left;
                        const y = event.clientY - containerRect.top;
                        
                        tooltip
                            .style('opacity', 1)
                            .html(`
                                <strong>${groupKey} - ${metric}</strong><br/>
                                Count: ${stats.count}<br/>
                                Min: ${stats.min.toFixed(2)}<br/>
                                Q1: ${stats.q1.toFixed(2)}<br/>
                                Median: ${stats.median.toFixed(2)}<br/>
                                Q3: ${stats.q3.toFixed(2)}<br/>
                                Max: ${stats.max.toFixed(2)}<br/>
                                Mean: ${stats.mean.toFixed(2)}<br/>
                                Outliers: ${stats.outliers.length}
                            `)
                            .style('left', (x + 15) + 'px')    // Relative to container + small offset
                            .style('top', (y - 5) + 'px');     // Relative to container - small offset
                    }
                    
                    // Highlight the box
                    group.selectAll('rect, line, circle')
                        .transition()
                        .duration(150)
                        .style('opacity', 0.8)
                        .attr('stroke-width', function() {
                            return parseFloat(d3.select(this).attr('stroke-width') || 1) * 1.5;
                        });
                })
                .on('mouseleave', function(event, d) {
                    // Hide tooltip
                    tooltip.style('opacity', 0);
                    
                    // Reset highlight
                    d3.select(this).selectAll('rect, line, circle')
                        .transition()
                        .duration(150)
                        .style('opacity', null)
                        .attr('stroke-width', function() {
                            const currentWidth = parseFloat(d3.select(this).attr('stroke-width') || 1);
                            return currentWidth / 1.5;
                        });
                })
                .on('mousemove', function(event) {
                    // Update tooltip position - use container-relative coordinates
                    const containerRect = self._container.getBoundingClientRect();
                    const x = event.clientX - containerRect.left;
                    const y = event.clientY - containerRect.top;
                    
                    tooltip
                        .style('left', (x + 15) + 'px')
                        .style('top', (y - 5) + 'px');
                })
                .on('click', function(event, d) {
                    const group = d3.select(this);
                    const groupKey = group.attr('data-group');
                    const metric = group.attr('data-metric');
                    
                    const boxData = processedData.find(pd => 
                        pd.groupKey === groupKey && pd.metric === metric
                    );

                    if (boxData) {
                        // Dispatch Perspective click event
                        self.dispatchEvent(
                            new CustomEvent("perspective-click", {
                                bubbles: true,
                                composed: true,
                                detail: {
                                    column_names: [metric],
                                    config: { filters: [] },
                                    row: { [metric]: boxData.stats.median }
                                }
                            })
                        );
                    }
                });
        }

        async update(view) {
            return this.draw(view);
        }

        async clear() {
            if (this._container) {
                this._container.innerHTML = "";
            }
        }

        async resize() {
            // Re-render on resize
            if (this._view) {
                return this.draw(this._view);
            }
        }

        async save() {
            return {
                // Save any user settings here
            };
        }

        async restore(config) {
            // Restore user settings here
        }

        async delete() {
            if (this._container) {
                this._container.innerHTML = "";
                this._container = null;
            }
            this._chart = null;
            this._view = null;
        }
    }

    // Register the custom element
    if (!window.customElements.get("perspective-viewer-boxplot")) {
        window.customElements.define("perspective-viewer-boxplot", BoxplotPlugin);
        console.log("Registered perspective-viewer-boxplot custom element");

        // Verify registration worked
        const registered = window.customElements.get("perspective-viewer-boxplot");
        console.log("Verification - plugin registered:", !!registered);
    } else {
        console.log("perspective-viewer-boxplot already registered");
    }

    // Register with perspective-viewer
    const perspectiveViewerElement = window.customElements.get("perspective-viewer");
    if (perspectiveViewerElement && perspectiveViewerElement.registerPlugin) {
        try {
            await perspectiveViewerElement.registerPlugin("perspective-viewer-boxplot");
            console.log("Registered boxplot plugin with perspective-viewer successfully");
        } catch (error) {
            console.error("Error registering plugin with perspective-viewer:", error);
        }
    } else {
        console.error("Could not register plugin - perspective-viewer not found or no registerPlugin method");
        console.log("perspectiveViewerElement:", perspectiveViewerElement);
        console.log("registerPlugin method:", perspectiveViewerElement?.registerPlugin);
    }
}

// Load the plugin when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPerspectiveBoxplotPlugin);
} else {
    loadPerspectiveBoxplotPlugin();
}

// Export the plugin loading function for manual usage
export { loadPerspectiveBoxplotPlugin };
export default loadPerspectiveBoxplotPlugin;