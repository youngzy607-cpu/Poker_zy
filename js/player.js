class Player {
    constructor(name, chips, isComputer = false, personality = {}) {
        this.name = name;
        this.chips = chips;
        this.hand = [];
        this.isComputer = isComputer;
        this.currentBet = 0;
        this.folded = false;
        this.isActive = true;
        this.isSittingOut = false; // New: For waiting rebuy
        
        // Personality Attributes (0.0 - 1.0)
        this.aggression = personality.aggression || 0.5; // High: Likes to Raise
        this.tightness = personality.tightness || 0.5;   // High: Plays fewer hands
        this.bluffFrequency = personality.bluffFrequency || 0.1; // High: Bluffs more
    }

    receiveCard(card) {
        this.hand.push(card);
    }

    resetHand() {
        this.hand = [];
        this.currentBet = 0;
        this.folded = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}
