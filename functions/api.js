const express = require('express');
const axios = require('axios');
const path = require('path');
const serverless = require('serverless-http');
const app = express();

const ETHERSCAN_API_KEY = 'C12FP7BFRQ53RA92W5VVQWBZG1WQ3H9GY6';
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/api';

// In-memory leaderboard based solely on submitted wallets (no duplicates)
let leaderboard = [];

// Middleware to parse JSON bodies
app.use(express.json());

// (We won’t serve static files from here since our frontend will be deployed separately on Netlify’s static hosting)

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
app.post('/wallet', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  const transactions = await fetchTransactions(address);
  if (!transactions || transactions.length === 0) {
    return res.status(500).json({ error: 'Failed to fetch transactions or no transactions available' });
  }
  
  if (transactions.length < 10) {
    return res.json({ 
      qualifies: false, 
      message: 'Wallet does not qualify because it has fewer than 10 transactions.' 
    });
  }
  
  const pnl = calculatePnL(transactions, address);
  
  if (pnl < 0) {
    const index = leaderboard.findIndex(item => item.address.toLowerCase() === address.toLowerCase());
    if (index === -1) {
      leaderboard.push({ address, pnl });
    } else {
      leaderboard[index].pnl = pnl;
    }
    leaderboard.sort((a, b) => a.pnl - b.pnl);
    leaderboard = leaderboard.slice(0, 100);
  }
  
  return res.json({
    qualifies: true,
    pnl,
    leaderboard
  });
});

// Endpoint: Get the current leaderboard
app.get('/leaderboard', (req, res) => {
  res.json({ leaderboard });
});

// Export the handler for Netlify Functions
module.exports.handler = serverless(app);
