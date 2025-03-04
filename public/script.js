// API base URL - automatically switches between local and production
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api'
  : '/.netlify/functions/api';

// Elements
const walletInput = document.querySelector('#wallet-input');
const checkButton = document.querySelector('#check-button');
const resultDiv = document.querySelector('#result');
const errorDiv = document.querySelector('#error');

// Add these new elements
const modal = document.getElementById("popupModal");
const closeModal = document.getElementById("closeModal");
const popupMessage = document.getElementById("popupMessage");

// Add modal control functions
closeModal.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
    if (event.target === modal) {
        modal.style.display = "none";
    }
};

// Add witty remarks function
function getWittyRemark(pnl) {
    const loserRemarks = [
        `🔥 Holy moly! You're down ${Math.abs(pnl).toFixed(4)} ETH! You truly belong here.`,
        `💸 Congratulations! You lost ${Math.abs(pnl).toFixed(4)} ETH. Your loss is legendary!`,
        `🎯 Down ${Math.abs(pnl).toFixed(4)} ETH? You're really gunning for that #1 loser spot!`,
        `🏆 ${Math.abs(pnl).toFixed(4)} ETH gone! You're what this website was made for!`,
        `📉 ${Math.abs(pnl).toFixed(4)} ETH vanished! Your diamond hands are made of paper!`
    ];

    const winnerRemarks = [
        `❌ ${pnl.toFixed(4)} ETH in profit? Sorry, winners not allowed here!`,
        `🚫 Get out of here with your ${pnl.toFixed(4)} ETH profit! This is a losers-only club.`,
        `⛔ ${pnl.toFixed(4)} ETH profit? Wrong neighborhood, buddy!`,
        `🎭 A ${pnl.toFixed(4)} ETH winner pretending to be a loser? Nice try!`,
        `🏃‍♂️ ${pnl.toFixed(4)} ETH profit detected! Quick, run before you catch the loss bug!`
    ];

    return pnl < 0 
        ? loserRemarks[Math.floor(Math.random() * loserRemarks.length)]
        : winnerRemarks[Math.floor(Math.random() * winnerRemarks.length)];
}

async function checkWallet(address) {
    try {
        // Show loading state
        checkButton.disabled = true;
        resultDiv.textContent = 'Checking wallet...';
        errorDiv.textContent = '';

        const response = await fetch(`${API_BASE}/wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ address })
        });

        const data = await response.json();

        // Clear loading state
        checkButton.disabled = false;

        if (data.error) {
            errorDiv.textContent = data.error;
            resultDiv.textContent = '';
            return;
        }

        if (!data.qualifies) {
            errorDiv.textContent = data.message;
            resultDiv.textContent = '';
            return;
        }

        // Display results and show popup
        const pnl = data.pnl;
        const message = getWittyRemark(pnl);
        
        // Update popup content
        popupMessage.innerHTML = `
            <div class="result-details">
                <div class="wallet-address">
                    ${address.slice(0, 6)}...${address.slice(-4)}
                </div>
                <div class="pnl-amount ${pnl < 0 ? 'negative' : 'positive'}">
                    ${pnl.toFixed(4)} ETH
                </div>
                <div class="witty-message">
                    ${message}
                </div>
            </div>
        `;
        
        // Show modal
        modal.style.display = "block";

        // Update leaderboard if available
        updateLeaderboard(data.leaderboard);

    } catch (error) {
        console.error('Error:', error);
        errorDiv.textContent = 'Error checking wallet. Please try again.';
        resultDiv.textContent = '';
        checkButton.disabled = false;
    }
}

function updateLeaderboard(leaderboard) {
    const leaderboardBody = document.querySelector('#leaderboardBody');
    if (!leaderboardBody || !leaderboard) return;

    if (leaderboard.length === 0) {
        leaderboardBody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center;">No data available.</td>
            </tr>
        `;
        return;
    }

    const html = leaderboard
        .map((entry, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${entry.address.slice(0, 6)}...${entry.address.slice(-4)}</td>
                <td class="negative">${entry.pnl.toFixed(4)} ETH</td>
            </tr>
        `)
        .join('');

    leaderboardBody.innerHTML = html;
}

// Event Listeners
checkButton?.addEventListener('click', () => {
    const address = walletInput.value.trim();
    if (address) {
        checkWallet(address);
    }
});

// Optional: Load leaderboard on page load
async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_BASE}/leaderboard`);
        const data = await response.json();
        updateLeaderboard(data.leaderboard);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Load leaderboard when page loads
document.addEventListener('DOMContentLoaded', loadLeaderboard);

// Add image saving functionality
document.getElementById("saveImage").addEventListener("click", () => {
    html2canvas(document.getElementById("popupContent")).then(canvas => {
        const imgData = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = 'eth_biggest_loser.png';
        link.href = imgData;
        link.click();
    });
}); 