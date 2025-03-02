const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const ETHERSCAN_API_KEY = 'C12FP7BFRQ53RA92W5VVQWBZG1WQ3H9GY6';
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/api';

// In-memory leaderboard based solely on submitted wallets (no duplicates)
let leaderboard = [];

// Middleware to parse JSON bodies and serve static files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Fetch transactions for a given wallet address
async function fetchTransactions(address) {
  const url = `${ETHERSCAN_BASE_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  try {
    const response = await axios.get(url);
    if (response.data.status === "1") {
      return response.data.result;
    } else {
      console.warn(`Warning for wallet ${address}: ${response.data.result}`);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching transactions for ${address}:`, error);
    return [];
  }
}

// Helper: Calculate profit and loss (P&L) for a wallet.
// Simplified: P&L = totalReceived - totalSent (in ETH)
function calculatePnL(transactions, wallet) {
  let totalSent = 0;
  let totalReceived = 0;
  transactions.forEach(tx => {
    const value = parseFloat(tx.value) / 1e18;
    if (tx.from.toLowerCase() === wallet.toLowerCase()) {
      totalSent += value;
    }
    if (tx.to.toLowerCase() === wallet.toLowerCase()) {
      totalReceived += value;
    }
  });
  return totalReceived - totalSent;
}

// Endpoint: Process a wallet submission and calculate its P&L
app.post('/api/wallet', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  const transactions = await fetchTransactions(address);
  if (!transactions || transactions.length === 0) {
    return res.status(500).json({ error: 'Failed to fetch transactions or no transactions available' });
  }
  
  // Ensure the wallet qualifies: at least 10 transactions
  if (transactions.length < 10) {
    return res.json({ 
      qualifies: false, 
      message: 'Wallet does not qualify because it has fewer than 10 transactions.' 
    });
  }
  
  // Calculate profit and loss (P&L)
  const pnl = calculatePnL(transactions, address);
  
  // Only add/update the leaderboard if the wallet is a loser (negative P&L)
  if (pnl < 0) {
    const index = leaderboard.findIndex(item => item.address.toLowerCase() === address.toLowerCase());
    if (index === -1) {
      leaderboard.push({ address, pnl });
    } else {
      // If already exists, just update the P&L
      leaderboard[index].pnl = pnl;
    }
    // Sort leaderboard by biggest loss first and keep top 100
    leaderboard.sort((a, b) => a.pnl - b.pnl);
    leaderboard = leaderboard.slice(0, 100);
  }
  
  return res.json({
    qualifies: true,
    pnl,
    leaderboard
  });
});

// Endpoint: Get the current leaderboard (top 100 losing wallets from submissions)
app.get('/api/leaderboard', (req, res) => {
  res.json({ leaderboard });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
