class Player {
    constructor(name, chips, isComputer = false) {
        this.name = name;
        this.chips = chips;
        this.hand = [];
        this.isComputer = isComputer;
        this.currentBet = 0;
        this.folded = false;
        this.isActive = true; 
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
