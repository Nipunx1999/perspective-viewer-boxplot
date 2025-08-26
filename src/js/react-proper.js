// Proper React integration - registers plugin globally with Perspective
import * as d3 from 'd3';

async function loadPerspectiveBoxplotPlugin() {
    // Wait for perspective-viewer to be fully loaded
    while (!window.customElements.get("perspective-viewer")) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const BasePlugin = window.customElements.get("perspective-viewer-plugin");
    const Viewer = window.customElements.get("perspective-viewer");
    
    if (!BasePlugin || !Viewer) {
        console.error("Perspective viewer components not found");
        return;
    }

    class BoxplotPlugin extends BasePlugin {
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

                console.log("View config:", config);
                console.log("Schema:", schema);

                // Get raw data from the view
                const rawData = await view.to_json();
                
                if (!rawData || rawData.length === 0) {
                    this._container.innerHTML = '<div style="text-align: center; padding: 20px;">No data available for boxplot</div>';
                    return;
                }

                // Clear previous chart
                this._container.innerHTML = '';

                // Determine grouping strategy
                const columns = config.columns || [];
                let groupByColumn = null;
                let metricColumns = [];

                // Get column types
                const columnTypes = {};
                Object.entries(schema).forEach(([col, type]) => {
                    columnTypes[col] = type;
                });

                // Find categorical and numeric columns
                const categoricalColumns = columns.filter(col => 
                    columnTypes[col] === 'string' || columnTypes[col] === 'date'
                );
                const numericColumns = columns.filter(col => 
                    columnTypes[col] === 'integer' || columnTypes[col] === 'float'
                );

                console.log("Categorical columns:", categoricalColumns);
                console.log("Numeric columns:", numericColumns);

                if (numericColumns.length === 0) {
                    this._container.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">No numeric data available for boxplot</div>';
                    return;
                }

                // Strategy 1: Use config.group_by if provided (from UI)
                if (config.group_by && config.group_by.length > 0) {
                    groupByColumn = config.group_by[0];
                    metricColumns = numericColumns;
                }
                // Strategy 2: If exactly one categorical column, use it for grouping
                else if (categoricalColumns.length === 1) {
                    groupByColumn = categoricalColumns[0];
                    metricColumns = numericColumns;
                }
                // Strategy 3: Multiple categorical columns - warn and use first
                else if (categoricalColumns.length > 1) {
                    console.warn(`Multiple categorical columns found: ${categoricalColumns.join(', ')}. Using '${categoricalColumns[0]}'`);
                    groupByColumn = categoricalColumns[0];
                    metricColumns = numericColumns;
                }
                // Strategy 4: No categorical columns - show metrics side-by-side
                else {
                    groupByColumn = null;
                    metricColumns = numericColumns;
                }

                console.log("Group by column:", groupByColumn);
                console.log("Metric columns:", metricColumns);

                this.renderBoxplot(rawData, groupByColumn, metricColumns);
            } catch (error) {
                console.error("Error in draw:", error);
                this._container.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">Error: ${error.message}</div>`;
            }
        }

        renderBoxplot(data, groupByColumn, metricColumns) {
            const margin = { top: 40, right: 150, bottom: 60, left: 80 };
            const width = this._container.clientWidth - margin.left - margin.right;
            const height = this._container.clientHeight - margin.top - margin.bottom;

            const svg = d3.select(this._container)
                .append("svg")
                .attr("width", this._container.clientWidth)
                .attr("height", this._container.clientHeight);

            const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // Process data based on grouping strategy
            let boxplotData = [];

            if (groupByColumn) {
                // Group data by categorical column
                const groupedData = d3.group(data, d => d[groupByColumn]);
                
                groupedData.forEach((values, group) => {
                    metricColumns.forEach(metric => {
                        const metricValues = values
                            .map(d => +d[metric])
                            .filter(v => !isNaN(v))
                            .sort(d3.ascending);

                        if (metricValues.length > 0) {
                            boxplotData.push({
                                group: group,
                                metric: metric,
                                values: metricValues,
                                stats: this.calculateBoxplotStats(metricValues)
                            });
                        }
                    });
                });
            } else {
                // No grouping - show metrics side-by-side
                metricColumns.forEach(metric => {
                    const metricValues = data
                        .map(d => +d[metric])
                        .filter(v => !isNaN(v))
                        .sort(d3.ascending);

                    if (metricValues.length > 0) {
                        boxplotData.push({
                            group: metric,
                            metric: metric,
                            values: metricValues,
                            stats: this.calculateBoxplotStats(metricValues)
                        });
                    }
                });
            }

            if (boxplotData.length === 0) {
                this._container.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">No valid data for boxplot</div>';
                return;
            }

            // Create scales
            const groups = [...new Set(boxplotData.map(d => d.group))];
            const metrics = [...new Set(boxplotData.map(d => d.metric))];
            
            const xScale = d3.scaleBand()
                .domain(groups)
                .range([0, width])
                .padding(0.2);

            const allValues = boxplotData.flatMap(d => [...d.values, ...d.stats.outliers]);
            const yScale = d3.scaleLinear()
                .domain(d3.extent(allValues))
                .nice()
                .range([height, 0]);

            const colorScale = d3.scaleOrdinal()
                .domain(metrics)
                .range(d3.schemeCategory10);

            // Create axes
            g.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(xScale))
                .selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-0.8em")
                .attr("dy", "0.15em")
                .attr("transform", "rotate(-45)");

            g.append("g")
                .call(d3.axisLeft(yScale));

            // Group data by group for side-by-side display
            const groupedBoxplotData = d3.group(boxplotData, d => d.group);
            
            const boxWidth = Math.min(50, xScale.bandwidth() / metrics.length);

            // Create tooltip
            const tooltip = d3.select(this._container)
                .append("div")
                .style("position", "absolute")
                .style("background", "rgba(0, 0, 0, 0.8)")
                .style("color", "white")
                .style("padding", "10px")
                .style("border-radius", "5px")
                .style("font-size", "12px")
                .style("pointer-events", "none")
                .style("opacity", 0);

            // Draw boxplots
            groupedBoxplotData.forEach((metricData, group) => {
                metricData.forEach((d, i) => {
                    const xPos = xScale(group) + (i * boxWidth) + (xScale.bandwidth() - metrics.length * boxWidth) / 2;
                    
                    // Box
                    const boxGroup = g.append("g")
                        .style("cursor", "pointer");

                    // Main box
                    boxGroup.append("rect")
                        .attr("x", xPos)
                        .attr("y", yScale(d.stats.q3))
                        .attr("width", boxWidth)
                        .attr("height", yScale(d.stats.q1) - yScale(d.stats.q3))
                        .attr("fill", colorScale(d.metric))
                        .attr("fill-opacity", 0.7)
                        .attr("stroke", colorScale(d.metric))
                        .attr("stroke-width", 2);

                    // Median line
                    boxGroup.append("line")
                        .attr("x1", xPos)
                        .attr("x2", xPos + boxWidth)
                        .attr("y1", yScale(d.stats.median))
                        .attr("y2", yScale(d.stats.median))
                        .attr("stroke", "black")
                        .attr("stroke-width", 2);

                    // Whiskers
                    const whiskerWidth = boxWidth * 0.6;
                    const whiskerOffset = boxWidth * 0.2;
                    
                    // Upper whisker
                    boxGroup.append("line")
                        .attr("x1", xPos + boxWidth/2)
                        .attr("x2", xPos + boxWidth/2)
                        .attr("y1", yScale(d.stats.q3))
                        .attr("y2", yScale(d.stats.max))
                        .attr("stroke", colorScale(d.metric))
                        .attr("stroke-width", 1);
                    
                    boxGroup.append("line")
                        .attr("x1", xPos + whiskerOffset)
                        .attr("x2", xPos + whiskerOffset + whiskerWidth)
                        .attr("y1", yScale(d.stats.max))
                        .attr("y2", yScale(d.stats.max))
                        .attr("stroke", colorScale(d.metric))
                        .attr("stroke-width", 1);

                    // Lower whisker
                    boxGroup.append("line")
                        .attr("x1", xPos + boxWidth/2)
                        .attr("x2", xPos + boxWidth/2)
                        .attr("y1", yScale(d.stats.q1))
                        .attr("y2", yScale(d.stats.min))
                        .attr("stroke", colorScale(d.metric))
                        .attr("stroke-width", 1);
                    
                    boxGroup.append("line")
                        .attr("x1", xPos + whiskerOffset)
                        .attr("x2", xPos + whiskerOffset + whiskerWidth)
                        .attr("y1", yScale(d.stats.min))
                        .attr("y2", yScale(d.stats.min))
                        .attr("stroke", colorScale(d.metric))
                        .attr("stroke-width", 1);

                    // Outliers
                    boxGroup.selectAll(".outlier")
                        .data(d.stats.outliers)
                        .enter().append("circle")
                        .attr("class", "outlier")
                        .attr("cx", xPos + boxWidth/2)
                        .attr("cy", d => yScale(d))
                        .attr("r", 3)
                        .attr("fill", colorScale(d.metric))
                        .attr("stroke", "white")
                        .attr("stroke-width", 1);

                    // Hover events
                    boxGroup
                        .on("mouseover", (event) => {
                            boxGroup.select("rect").attr("fill-opacity", 0.9);
                            
                            const tooltipHtml = `
                                <strong>${groupByColumn ? group : 'All'} - ${d.metric}</strong><br/>
                                Count: ${d.stats.count}<br/>
                                Min: ${d.stats.min.toFixed(2)}<br/>
                                Q1: ${d.stats.q1.toFixed(2)}<br/>
                                Median: ${d.stats.median.toFixed(2)}<br/>
                                Q3: ${d.stats.q3.toFixed(2)}<br/>
                                Max: ${d.stats.max.toFixed(2)}<br/>
                                Mean: ${d.stats.mean.toFixed(2)}<br/>
                                Outliers: ${d.stats.outliers.length}
                            `;
                            
                            const containerRect = this._container.getBoundingClientRect();
                            
                            tooltip.html(tooltipHtml)
                                .style("left", (event.clientX - containerRect.left + 10) + "px")
                                .style("top", (event.clientY - containerRect.top - 10) + "px")
                                .transition()
                                .duration(200)
                                .style("opacity", 1);
                        })
                        .on("mouseout", () => {
                            boxGroup.select("rect").attr("fill-opacity", 0.7);
                            tooltip.transition()
                                .duration(200)
                                .style("opacity", 0);
                        });
                });
            });

            // Legend
            if (metrics.length > 1) {
                const legend = svg.append("g")
                    .attr("transform", `translate(${width + margin.left + 20}, ${margin.top})`);

                metrics.forEach((metric, i) => {
                    const legendRow = legend.append("g")
                        .attr("transform", `translate(0, ${i * 20})`);

                    legendRow.append("rect")
                        .attr("width", 15)
                        .attr("height", 15)
                        .attr("fill", colorScale(metric));

                    legendRow.append("text")
                        .attr("x", 20)
                        .attr("y", 12)
                        .text(metric)
                        .style("font-size", "12px")
                        .style("alignment-baseline", "middle");
                });
            }

            // Axis labels
            g.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (height / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .text("Value");

            g.append("text")
                .attr("transform", `translate(${width/2}, ${height + margin.bottom - 10})`)
                .style("text-anchor", "middle")
                .text(groupByColumn || "Metrics");
        }

        calculateBoxplotStats(values) {
            const sorted = values.slice().sort(d3.ascending);
            const n = sorted.length;
            
            const q1 = d3.quantile(sorted, 0.25);
            const median = d3.quantile(sorted, 0.5);
            const q3 = d3.quantile(sorted, 0.75);
            const iqr = q3 - q1;
            
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;
            
            const outliers = sorted.filter(v => v < lowerFence || v > upperFence);
            const nonOutliers = sorted.filter(v => v >= lowerFence && v <= upperFence);
            
            const min = nonOutliers.length > 0 ? nonOutliers[0] : sorted[0];
            const max = nonOutliers.length > 0 ? nonOutliers[nonOutliers.length - 1] : sorted[sorted.length - 1];
            const mean = d3.mean(sorted);
            
            return {
                count: n,
                min,
                q1,
                median,
                q3,
                max,
                mean,
                outliers
            };
        }
    }

    // Define the custom element first
    if (!window.customElements.get("perspective-viewer-boxplot")) {
        window.customElements.define("perspective-viewer-boxplot", BoxplotPlugin);
    }

    // Register the plugin with Perspective Viewer using the correct API
    try {
        Viewer.registerPlugin("perspective-viewer-boxplot");
        console.log("Boxplot plugin registered successfully with Perspective");
    } catch (error) {
        console.error("Error registering boxplot plugin:", error);
    }
}

// Auto-load when imported
loadPerspectiveBoxplotPlugin().catch(console.error);

export default {};