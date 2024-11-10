import './App.css';
import StockGraph from './components/stockGraph';

function App() {
  return (
    <div id='stock-graph-wrapper' className='app'>
      <StockGraph /> {/* Using the StockGraph component */}
    </div>
  );
}

export default App;
