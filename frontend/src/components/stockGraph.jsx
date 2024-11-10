import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

import './stockGraph.css';
import useDebounce from './../hooks/useDebounce';
import { TIMESTAMP_FORMAT } from './../utils/timestampFormat';

const StockGraph = () => {
    const [stock, setStock] = useState('ANF'); 
    const debouncedStock = useDebounce(stock, 500);
    // const [startDate, setStartDate] = useState('2024-10-15'); // default start date
    const [startDate, setStartDate] = useState('1900-01-01'); // default start date
    const [endDate, setEndDate] = useState('2024-10-16'); // default end date
    const [profit, setProfit] = useState(null);
    const [purchaseAmount, setPurchaseAmount] = useState(100); // default purchase amount $100
    const [stockData, setStockData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [earliestDate, setEarliestDate] = useState('');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const [formattedStockData, setFormattedStockData] = useState('');

    const svgRef = useRef(); // rerender graph everytime svg is changed

    useEffect(() => {
        setFormattedStockData(JSON.stringify(stockData, null, 2)); // 2 spaces for pretty printing
    }, [stockData]);

    useEffect(() => {
        fetchEarliestDate(); // earliest date possible for a given stock
    }, [debouncedStock]);

    useEffect(() => {
        if (debouncedStock && startDate && endDate) {
            fetchStockData();
        }
    }, [debouncedStock, startDate, endDate, purchaseAmount]);

    useEffect(() => {
        if (stockData.length) {
            drawGraph();
        }
    }, [stockData]);

    function formatDateString(dateString){
        const match = dateString.match(/^(\d{4}-\d{2}-\d{2})/); // YYYY-MM-DD
        return match ? match[1] : '';
    }

    const fetchStockData = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `http://localhost:5000/api/stocks?stock=${debouncedStock}&startDate=${startDate}&endDate=${endDate}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const result = await response.json();

            let previousPrice = null; // used whenever price comes back as null
            const formattedStockData = result.map(item => {
                const date = new Date(item.timestamp * 1000);
                const price = item.price !== null ? item.price : previousPrice; // most recent known price
                previousPrice = price;
                return { date, price };
            });
            setStockData(formattedStockData);
            calculateProfit(formattedStockData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // returns data point closest to mouse position
    const findClosestDataPoint = (stockData, dateAtMouse) => {
        // binary search to find this faster
        var left = 0;
        var right = stockData.length-1;
        while(left < right){
            var mid = Math.floor((right+left)/2);
            var midDate = stockData[mid].date;
            if(midDate.getTime() === dateAtMouse.getTime()) break;
            if(midDate < dateAtMouse){
                left = mid+1;
            }else{
                right = mid-1;
            }
        }
        return stockData[mid];
    }


    const drawGraph = () => {
        // dimensions for graph
        const margin = { top: 20, right: 30, bottom: 40, left: 40 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // remove old graph
        d3.select(svgRef.current).selectAll('*').remove();

        // create new graph
        const svg = d3.select(svgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        let closestData;
        const handleMousemove = (e) => {
            const [mouseX] = d3.pointer(e);
            const dateAtMouse = x.invert(mouseX); // gets x intercept
            closestData = findClosestDataPoint(stockData,dateAtMouse); // finds closest value in stock data array
            if(closestData){
                // update tooltip
                tooltip
                    .html(`<strong>Date:</strong><br> ${d3.timeFormat(TIMESTAMP_FORMAT)(closestData.date)}<br><strong>Price:</strong><br> $${closestData?.price?.toFixed(2)}`)
                    .style('opacity', 1)
                    .style('x', `${e.pageX-30}px`)
                    .style('y', `${e.pageY-200}px`);
                trackerLine
                    .attr('x1', x(dateAtMouse))
                    .attr('x2', x(dateAtMouse))
                    .attr('y1', 0)
                    .attr('y2', height);
                ball
                    .attr('cx', x(dateAtMouse))
                    .attr('cy', y(closestData.price));
            }
        };
        svg.on('mousemove', handleMousemove); // update ui when mouse moves
        svg.on('mouseout',()=>{ // hide tooltips when the cursor leaves the graph
            trackerLine.style('opacity',0);
            tooltip.style('opacity',0);
            ball.style('opacity',0);
        })


        // add the x and y axes
        const x = d3.scaleTime()
            .domain(d3.extent(stockData, d => d.date))
            .range([0, width]);
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        const y = d3.scaleLinear()
            .domain([0, d3.max(stockData, d => d.price)])
            .range([height, 0]);
        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(y));

        // maps x and y access to date and price attributes
        const line = d3.line()
            .x(d => x(d.date))
            .y(d => y(d.price));


        // add the graphed line
        svg.append('path')
            .attr('class','line')
            .datum(stockData) // plugs in data
            .attr('fill', 'none')
            .attr('d', line)
            .attr('clip-path','url(#clip)'); // clipping path keeps graphed line from going over axes on zoom

        // pass attributes from object to object, prefix style attributes with 'style-'
        const passAttributes = (object, attrs) => {
            for(let key in attrs) {
                if(attrs.hasOwnProperty(key)) {
                    if (key.match(/^style\-/)) {
                        object.style(key.slice(6), attrs[key]); // add 'style-'s as style attributes
                    } else if (key === 'html') {
                        object.html(attrs[key]); // add html as html
                    } else {
                        object.attr(key, attrs[key]); // add everything else as an attr
                    }
                }
            }
            return object;
        }

        const trackerGroup = svg.append('g').attr('class', 'tracker-line-group').style('z-index', 1); // needed because this allows proper z-index stacking 

        const createTrackerLine = (extraAttrs = {}) => {
            var trackerLine = trackerGroup.append('line')
                .attr('class','tracker-line')
                .attr('y1', 0)
                .attr('y2', height);
            trackerLine = passAttributes(trackerLine, extraAttrs);
            return trackerLine;
        }

        const trackerLine = createTrackerLine(); // create hovering tracker line

        const createTrackerBall = (extraAttrs = {}) => {
            var ball = svg.append('circle')
                .attr('class','tracker-ball')
                .attr('r', 2);
            ball = passAttributes(ball, extraAttrs);
            return ball;
        }

        const ball = createTrackerBall(); // create hovering tracker line ball to show where it intersects the tracker

        const createTooltip = (extraAttrs = {}) => {
            var tooltip = svg.append('foreignObject').attr('class', 'tooltip');
            tooltip = passAttributes(tooltip, extraAttrs);
            return tooltip;
        }

        const tooltip = createTooltip(); // shows info about the data at the cursor's intersects

        // invisible rectangle for detecting mouseover event
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .style('z-index',99)
            .style('fill', 'none')
            .style('pointer-events', 'all');

        // clipping path to keep graphed line within borders
        svg.append('defs')
            .append('clipPath')
            .attr('id', 'clip')
            .append('rect')
            .attr('width', width)
            .attr('height', height);

        // set up zoom brush
        var brush = d3.brush() // brush event is a drag selection in d3
                    .on('end', (e)=>{
                        if(!e.selection) return

                        // gets the four corners of the users drag selection and sets the area of the selection to be the new domains of the axes
                        var [[x0, y0], [x1, y1]] = e.selection;
                        var minDate = x.invert(x0);
                        var maxDate = x.invert(x1);
                        var minValue = y.invert(y0);
                        var maxValue = y.invert(y1);

                        x.domain([Math.min(minDate,maxDate), Math.max(minDate,maxDate)]);
                        y.domain([Math.min(minValue,maxValue), Math.max(minValue,maxValue)]);
                 
                        // update the axes and the graphed line smoothly
                        svg.select('.x-axis')
                            .transition()
                            .duration(1000)
                            .call(d3.axisBottom(x));

                        svg.select('.y-axis')
                            .transition()
                            .duration(1000)
                            .call(d3.axisLeft(y));

                        svg.selectAll('.line')
                            .transition()
                            .duration(1000)
                            .attr('d', line);
                    });

        svg.append('g')
            .attr('class', 'brush')
            .call(brush);

        // copy and freeze current tooltip and tracker on click
        svg.on('click', function(e) {
            const frozenTrackerLine = createTrackerLine({
                'x1': x(closestData.date),
                'x2': x(closestData.date)
            });

            var frozenBall = createTrackerBall({
                'cx': x(closestData.date),
                'cy': y(closestData.price),
                'fill': 'purple',
                'stroke': 'purple'});

            var frozenTooltip = createTooltip()
                .attr('x',`${e.pageX-30}px`)
                .attr('y',`${e.pageY-200}px`)
                .style('opacity',1)
                .html(`<strong>Date:</strong><br> ${d3.timeFormat(TIMESTAMP_FORMAT)(closestData.date)}<br><strong>Price:</strong><br> $${closestData?.price?.toFixed(2)}`)
                .classed('frozen-tooltip',true);
        });
    };

    function formatAsCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    const calculateProfit = () => {
        if (stockData.length === 0) return;
        const initialPrice = stockData[0].price;
        const shares = (purchaseAmount/initialPrice);
        const finalPrice = stockData[stockData.length - 1].price;
        const profitAmount = ((shares*finalPrice) - (shares*initialPrice)).toFixed(2);
        setProfit(formatAsCurrency(profitAmount));
    };

    const fetchEarliestDate = async () => {
        try {
            const response = await axios.get(`http://localhost:5000/api/earliest-date?symbol=${debouncedStock}`);
            const newEarliestDate = formatDateString(response.data.earliestDate);
            setEarliestDate(newEarliestDate);

            if(new Date(newEarliestDate)>new Date(startDate)) {
                setStartDate(newEarliestDate);
            }

            // update endDate if it's earlier than the new earliest date
            if (new Date(endDate) < new Date(newEarliestDate)) {
                setEndDate(today); // reset endDate to today
            }
        } catch (error) {
            console.error('Error fetching earliest date:', error);
        }
    };

    return (
        <div>
            <h1>Stock Investment Graph</h1>
            Earliest date:{earliestDate}
            <br/>
            Start date:{startDate}
            <form>
                <table>
                    <thead>
                        <tr>
                            <th>Stock:</th>
                            <th>Start:</th>
                            <th>End:</th>
                            <th colSpan='100%'>Purchase Amount:</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <label>
                                    <input
                                        type='text'
                                        placeholder='Stock Symbol'
                                        value={stock}
                                        onChange={(e) => setStock(e.target.value)}
                                    />
                                </label>
                            </td>
                            <td>
                                <label>
                                    <input
                                        type='date'
                                        max={today}
                                        min={earliestDate}
                                        value={startDate}
                                        onChange={(e) => {
                                            const selectedDate = e.target.value;
                                            if (new Date(selectedDate) >= new Date(earliestDate) && new Date(selectedDate) <= new Date(today)) {
                                                setStartDate(selectedDate);
                                            }
                                        }}
                                    />
                                </label>
                            </td>
                            <td>
                                <label>
                                    <input
                                        type='date'
                                        max={today}
                                        min={earliestDate}
                                        value={endDate}
                                        onChange={(e)=> {
                                            const selectedDate = e.target.value;
                                            if (new Date(selectedDate) >= new Date(earliestDate) && new Date(selectedDate) <= new Date(today)) {
                                                setEndDate(selectedDate);
                                            }
                                        }}
                                    />
                                </label>
                            </td>
                            <td>
                                <label>
                                    <input
                                        type='number'
                                        value={purchaseAmount}
                                        onChange={(e) => setPurchaseAmount(e.target.value)}
                                        placeholder=''
                                    />
                                </label>
                            </td>
                            <td>
                                {/*<button type="submit">Fetch Data</button>*/}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </form>
            <svg ref={svgRef}></svg>
            <h2>Profit: {profit}</h2>
            {loading && <p>Loading...</p>}
            {error && <p>Error: {error}</p>}
            <pre>{/*formattedStockData*/}</pre>
        </div>
    );
};

export default StockGraph;