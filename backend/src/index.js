const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.port || 5000;

app.use(cors());
app.use(bodyParser.json());

// function to convert date to timestamp
const toUnixTimestamp = (date) => Math.floor(new Date(date).getTime() / 1000);

app.get('/api/stocks', async (req, res) => {
    const { stock, startDate, endDate } = req.query;

    if (!stock || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required query parameters: stock, startDate, endDate' });
    }

    const startDateTimestamp = new Date(startDate).getTime() / 1000;
    const endDateTimestamp = new Date(endDate).getTime() / 1000;
    const currentTime = Math.floor(Date.now() / 1000); 

	// determine the interval based on the date range
    const dateRange = endDateTimestamp - startDateTimestamp;
    let interval;
    let oneDayInSeconds = 24*60*60;
    let fromLast30Days = currentTime - (30*(oneDayInSeconds)) < startDateTimestamp;
    if (dateRange <= oneDayInSeconds && fromLast30Days) {
        interval = '1m'; // minute by minute
    }else{
        interval = '1d'; // day by day
    }


    // get stock data from Yahoo Finance API
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${stock}?period1=${startDateTimestamp}&period2=${endDateTimestamp}&interval=${interval}`;
    try {
        const response = await axios.get(url);
        const data = response.data;

		const filteredResults = data.chart.result[0].timestamp
		.map((timestamp, index) => ({ timestamp, price: data.chart.result[0].indicators.quote[0].close[index] }));
		// .filter(({ timestamp }) => timestamp >= startDateTimestamp && timestamp <= endDateTimestamp); // problem where random outlying values are included in response for some reason

		res.json(filteredResults);
    } catch (error) {
        console.error('Error fetching data from Yahoo Finance:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.get('/api/earliest-date', async (req, res) => {
    const { symbol } = req.query;

    try {
        // request a large range to ensure you get the earliest data
        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=100y`);

        const historicalData = response.data.chart.result[0];
        
        // Check if we have data for the requested symbol
        if (!historicalData || !historicalData.timestamp || historicalData.timestamp.length === 0) {
            return res.status(404).json({ error: 'Symbol not found or no historical data available' });
        }

        // get the earliest timestamp and convert to date
        const timestamps = historicalData.timestamp;
        const earliestTimestamp = Math.min(...timestamps);
        const earliestDate = new Date(earliestTimestamp * 1000);

        return res.json({ earliestDate });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching data' });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});




















