const SUITS = ['♠', '♥', '♣', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;
    }

    get color() {
        return (this.suit === '♥' || this.suit === '♦') ? 'red' : 'black';
    }

    get numValue() {
        return VALUE_MAP[this.value];
    }

    toString() {
        return `${this.value}${this.suit}`;
    }

    getHTML() {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');
        if (this.color === 'red') cardDiv.classList.add('red');
        cardDiv.innerHTML = `<div>${this.value}</div><div>${this.suit}</div>`;
        return cardDiv;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (let suit of SUITS) {
            for (let value of VALUES) {
                this.cards.push(new Card(suit, value));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        return this.cards.pop();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Card, Deck };
}
