// Carga de datos
d3.csv("./data.csv", d => {
    return {
        highSeverity: +d.HighSeverity, 
        humidity: +d['Humidity(%)'],
        temp: +d['Temperature(C)'],
        condition: d.Weather_Condition,
        // Filtros
        isRain: d.is_Rain === "True",
        isSnow: d.is_Snow === "True",
        isFog: d.is_Fog === "True",
        isClear: d.is_Clear === "True",
        isCloud: d.is_Cloud === "True"
    }
}).then(data => {
    // we use 15% so that some points are highlighted
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
        .domain([0, 0.15])
        .clamp(true);

    createBubblePlot(data, colorScale);
});

const createBubblePlot = (rawData, colorScale) => {
    const width = 800, height = 500;
    const margin = {top: 30, right: 30, bottom: 120, left: 60};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    d3.select("#scatterplot").html("");

    const svg = d3.select("#scatterplot")
        .append("svg")
        .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // we use global scales so that filters dont denormalize points
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([-28, 45]).range([innerHeight, 0]);
    const sizeScale = d3.scaleSqrt().range([2, 20]);

    // visual guides to differenciate 4 different scenarios
    g.append("line")
        .attr("x1", xScale(50)).attr("x2", xScale(50))
        .attr("y1", 0).attr("y2", innerHeight)
        .attr("stroke", "#ddd").attr("stroke-dasharray", "4,4");

    g.append("line")
        .attr("x1", 0).attr("x2", innerWidth)
        .attr("y1", yScale(10)).attr("y2", yScale(10))
        .attr("stroke", "#ddd").attr("stroke-dasharray", "4,4");

    g.append("text").attr("x", xScale(25)).attr("y", yScale(-20)).text("DRY & COLD").style("fill", "#bbb").style("font-size", "10px");
    g.append("text").attr("x", xScale(75)).attr("y", yScale(-20)).text("HUMID & COLD").style("fill", "#bbb").style("font-size", "10px");
    g.append("text").attr("x", xScale(25)).attr("y", yScale(40)).text("DRY & HOT").style("fill", "#bbb").style("font-size", "10px");
    g.append("text").attr("x", xScale(75)).attr("y", yScale(40)).text("HUMID & HOT").style("fill", "#bbb").style("font-size", "10px");

    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(10))
        .append("text")
        .attr("x", innerWidth / 2).attr("y", 40)
        .attr("fill", "#333").style("font-weight", "bold")
        .text("Humidity (%)");

    g.append("g")
        .call(d3.axisLeft(yScale))
        .append("text")
        .attr("transform", "rotate(-90)").attr("y", -45).attr("x", -innerHeight / 2)
        .attr("fill", "#333").style("font-weight", "bold")
        .text("Temperature (°C)");


    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

    // Crear los colores del gradiente usando tu escala actual
    const numStops = 10;
    for (let i = 0; i < numStops; i++) {
        const offset = i / (numStops - 1);
        linearGradient.append("stop")
            .attr("offset", (offset * 100) + "%")
            .attr("stop-color", colorScale(offset * 0.15)); // 0.15 es tu máximo
    }

    // Configuración de tamaño y posición
    const legendWidth = 300;
    const legendHeight = 10;
    
    // Posicionamos la leyenda centrada horizontalmente y cerca del fondo del SVG
    const legendGroup = svg.append("g")
        .attr("transform", `translate(${(width - legendWidth) / 2}, ${height - 45})`);

    // Título de la leyenda
    legendGroup.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -10)
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("text-anchor", "middle")
        .style("fill", "#333")
        .text("High severity risk (% of accidents)");

    // Rectángulo con el gradiente
    legendGroup.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    // Etiquetas (0% y 15%+)
    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", legendHeight + 12)
        .style("font-size", "10px")
        .style("fill", "#555")
        .text("0%");

    legendGroup.append("text")
        .attr("x", legendWidth)
        .attr("y", legendHeight + 12)
        .style("font-size", "10px")
        .style("text-anchor", "end")
        .style("fill", "#555")
        .text("+15%");

    const update = (filterKey) => {
        
        const filteredData = filterKey === 'all' 
            ? rawData 
            : rawData.filter(d => d[filterKey] === true);

        const bins = {};
        let maxCount = 0;

        filteredData.forEach(d => {
            if(isNaN(d.humidity) || isNaN(d.temp)) return;
            
            // grouping: 4% bins for humidity and 2ª for temperature
            const hBin = Math.round(d.humidity / 4) * 4; 
            const tBin = Math.round(d.temp / 2) * 2;
            const id = `${tBin}|${hBin}`;

            if (!bins[id]) {
                bins[id] = { id: id, temp: tBin, humidity: hBin, count: 0, sumSeverity: 0 };
            }
            bins[id].count++;
            bins[id].sumSeverity += d.highSeverity;
        });

        const binnedArray = Object.values(bins).map(b => {
            if (b.count > maxCount) maxCount = b.count;
            return {
                ...b,
                // here we colour the bubble
                riskRatio: b.count > 0 ? (b.sumSeverity / b.count) : 0
            };
        });

        binnedArray.sort((a, b) => b.count - a.count);
        sizeScale.domain([0, maxCount]);

        g.selectAll("circle")
            .data(binnedArray, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("cx", d => xScale(d.humidity))
                    .attr("cy", d => yScale(d.temp))
                    .attr("r", 0)
                    .attr("fill", d => colorScale(d.riskRatio))
                    .attr("stroke", "#ccc") 
                    .attr("stroke-width", 0.5)
                    .attr("opacity", 0.9)
                    .call(enter => enter.transition().duration(800)
                        .attr("r", d => sizeScale(d.count))),
                
                update => update.transition().duration(800)
                    .attr("r", d => sizeScale(d.count))
                    .attr("fill", d => colorScale(d.riskRatio)),

                exit => exit.transition().duration(500).attr("r", 0).remove()
            );
    };

    update("all");

    

    // Listeners
    d3.selectAll(".filter-btn").on("click", function() {
        d3.selectAll(".filter-btn").classed("active", false);
        d3.select(this).classed("active", true);
        const key = d3.select(this).attr("value");
        update(key);
    });
};