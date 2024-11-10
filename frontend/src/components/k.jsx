import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

import useDebounce from './../hooks/useDebounce';

const StockGraph = () => {
    const [stock, setStock] = useState('LLY'); // Stock symbol
    const debouncedStock = useDebounce(stock, 500);
    const [startDate, setStartDate] = useState('1900-01-01'); // Default start date
    const [endDate, setEndDate] = useState('2024-10-16'); // Default end date
    const [profit, setProfit] = useState(null);
    const [purchaseAmount, setPurchaseAmount] = useState(1000); // Default purchase amount
    const [stockData, setStockData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [earliestDate, setEarliestDate] = useState('');
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    
    const [formattedStockData, setFormattedStockData] = useState('');

    const svgRef = useRef(); // Ref for the SVG element

    useEffect(() => {
        setFormattedStockData(JSON.stringify(stockData, null, 2)); // 2 spaces for pretty printing
    }, [stockData]);

    useEffect(() => {
        fetchEarliestDate();
    }, [debouncedStock]);

    useEffect(() => {
        if (debouncedStock && startDate && endDate) {
            fetchStockData();
        }
    }, [debouncedStock, startDate, endDate]);

    useEffect(() => {
        if (stockData.length) {
            drawGraph(); // Call function to draw the graph
        }
    }, [stockData]);

    const fetchStockData = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `http://localhost:5000/api/stocks?stock=${debouncedStock}&startDate=${startDate}&endDate=${endDate}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const result = await response.json();
            // Combine dates and prices
            const formattedStockData = result.map((item) => ({
                date: new Date(item.timestamp * 1000),
                price: item.price
            }));
            setStockData(formattedStockData);
            calculateProfit(formattedStockData); // Calculate profit based on new data
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const drawGraph = () => {
        const margin = { top: 20, right: 30, bottom: 40, left: 40 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // Clear any previous SVG
        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleTime()
            .domain(d3.extent(stockData, d => d.date))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(stockData, d => d.price)])
            .range([height, 0]);

        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(y));

        const line = d3.line()
            .x(d => x(d.date))
            .y(d => y(d.price));

        svg.append('path')
            .datum(stockData)
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 1.5)
            .attr('d', line);
    };

    const calculateProfit = (data) => {
        if (data.length === 0) return;
        const initialPrice = data[0].price;
        const finalPrice = data[data.length - 1].price;
        const profitAmount = finalPrice - initialPrice;
        setProfit(profitAmount);
    };

    const fetchEarliestDate = async () => {
        try {
            const response = await axios.get(`http://localhost:5000/api/earliest-date?symbol=${debouncedStock}`);
            const newEarliestDate = formatDateString(response.data.earliestDate);
            setEarliestDate(newEarliestDate);

            // Update startDate if it goes out of range
            if (new Date(newEarliestDate) > new Date(startDate)) {
                setStartDate(newEarliestDate);
            }

            // Update endDate if it's earlier than the new earliest date
            if (new Date(endDate) < new Date(newEarliestDate)) {
                setEndDate(today); // Reset endDate to today
            }
        } catch (error) {
            console.error('Error fetching earliest date:', error);
        }
    };

    const formatDateString = (dateString) => {
        const match = dateString.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : '';
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        fetchStockData(); // Fetch data on form submission
    };

    return (
        <div>
            <h1>Stock Investment Graph</h1>
            Earliest date: {earliestDate}
            <br />
            Start date: {startDate}
            <form onSubmit={handleSubmit}>
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
                                        type="text"
                                        placeholder="Stock Symbol"
                                        value={stock}
                                        onChange={(e) => setStock(e.target.value)}
                                    />
                                </label>
                            </td>
                            <td>
                                <label>
                                    <input
                                        type="date"
                                        max={today}
                                        min={earliestDate ? new Date(earliestDate).toISOString().split('T')[0] : ''}
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
                                        type="date"
                                        max={today}
                                        min={earliestDate ? new Date(earliestDate).toISOString().split('T')[0] : ''}
                                        value={endDate}
                                        onChange={(e) => {
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
                                        type="number"
                                        value={purchaseAmount}
                                        onChange={(e) => setPurchaseAmount(e.target.value)}
                                        placeholder="Purchase Amount in USD"
                                    />
                                </label>
                            </td>
                            <td>
                                <button type="submit">Fetch Data</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </form>
            {loading && <p>Loading...</p>}
            {error && <p>Error: {error}</p>}
            <svg ref={svgRef}></svg>
            <pre>{formattedStockData}</pre>
        </div>
    );
};

export default StockGraph;
