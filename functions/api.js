const express = require('express');
const axios = require('axios');
const serverless = require('serverless-http');

const app = express();

// Use an environment variable for the API key if available
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'C12FP7BFRQ53RA92W5VVQWBZG1WQ3H9GY6';
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/api';

// In-memory leaderboard for submitted wallets (no duplicates)
let leaderboard = [];

// Middleware to parse JSON bodies
app.use(express.json());

// Endpoint to check wallet and calculate P/L
app.post('/api', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    console.log("Received wallet address:", address);

    // Build the Etherscan API URL
    const url = `${ETHERSCAN_BASE_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
    const response = await axios.get(url);
    
    // Check if Etherscan returned a successful status
    if (response.data.status !== "1") {
      console.error("Etherscan error for wallet", address, response.data);
      return res.status(500).json({ error: 'Error fetching transactions from Etherscan' });
    }
    
    const transactions = response.data.result;
    console.log(`Fetched ${transactions.length} transactions for wallet ${address}`);
    
    // Check if wallet qualifies (at least 10 transactions)
    if (transactions.length < 10) {
      return res.json({ 
        qualifies: false, 
        message: 'Wallet does not qualify because it has fewer than 10 transactions.' 
      });
    }
    
    // Calculate profit/loss (P/L)
    let totalSent = 0;
    let totalReceived = 0;
    transactions.forEach(tx => {
      const value = parseFloat(tx.value) / 1e18;
      if (tx.from.toLowerCase() === address.toLowerCase()) {
        totalSent += value;
      }
      if (tx.to.toLowerCase() === address.toLowerCase()) {
        totalReceived += value;
      }
    });
    const pnl = totalReceived - totalSent;
    console.log(`Calculated P/L for wallet ${address}: ${pnl} ETH`);
    
    // Update leaderboard if the wallet is a loser (negative P/L)
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
  } catch (error) {
    console.error("Error in /api endpoint:", error);
    return res.status(500).json({ error: 'Error checking wallet.' });
  }
});

// Endpoint to fetch the current leaderboard
app.get('/leaderboard', (req, res) => {
  try {
    return res.json({ leaderboard });
  } catch (error) {
    console.error("Error in /leaderboard endpoint:", error);
    return res.status(500).json({ error: 'Error fetching leaderboard.' });
  }
});

// Export the handler for Netlify Functions
module.exports.handler = serverless(app);
