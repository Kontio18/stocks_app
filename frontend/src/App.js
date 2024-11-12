import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, List } from 'antd';

import StockGraph from './components/StockGraph';
import StockSymbolList from './components/StockSymbolList';

const { Sider } = Layout;

function App() {

  const fetchStocks = async (query) => {
    console.log('query',query)
    const url = `http://localhost:5000/api/search-stocks?query=${!query ? 'A' : query}`;
    console.log('url',url)
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const result = await response.json();
    console.log('result',result)
    setAvailableStocks(result);
  };

  const [selectedStocks, setSelectedStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  // const [availableStocks, setAvailableStocks] = useState([{symbol:'ANF'},{symbol:'AAPL'},{symbol:'LLY'},{symbol:'NVD'},{symbol:'MLR'}]);
  const [availableStocks, setAvailableStocks] = useState([]);

  useEffect(()=>{
    setFilteredStocks(availableStocks);
  },[availableStocks]);

  const handleSearchStock = async (query) => {
    await fetchStocks(query);
  }

  const handleSelectStock = (stock) => {
    console.log('stock',stock)

    // if the stocks already selected do nothing
    if(selectedStocks.some((item) => item.symbol == stock.symbol)){
      setSelectedStocks(selectedStocks.filter((item) => item.symbol != stock.symbol));
    }else{
      setSelectedStocks([...selectedStocks, stock]);
    }
    // addStockLineToGraph(stock);
  };

  return (
    <div id='stock-graph-wrapper' className='app'>
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={300} style={{ background: '#fff', padding: '16px' }}>
        <StockSymbolList availableStocks={availableStocks} onSelectStock={handleSelectStock} selectedStocks={selectedStocks} filteredStocks={filteredStocks} onSearchStock={handleSearchStock} />
          {/* list of selected stocks */}
          <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#333' }}>Selected Stocks</h3>
          <List
            dataSource={selectedStocks}
            renderItem={stock => (
              <List.Item
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div>
                  <span style={{fontWeight: '600', color: '#333' }}>
                    {stock.symbol}
                  </span>
                  <br/>
                  <span style={{fontWeight: '300', color: '#555' }}>
                    {stock.name}
                  </span>
                </div>
                <Button
                  type="link"
                  onClick={() => handleSelectStock(stock)}
                  style={{
                    color: '#ff4d4f',
                    fontWeight: '500',
                    padding: '0',
                  }}
                >
                  Deselect
                </Button>
              </List.Item>
            )}
          />
        </div>
      </Sider>
      <Layout style={{ padding: '16px' }}>
        <StockGraph />
      </Layout>
    </Layout>
    </div>
  );
}

export default App;
