class OddsCalculator {
    static calculate(playerHand, communityCards, opponentCount, iterations = 300) {
        // Create a deck of remaining cards
        const fullDeck = [];
        for (let suit of SUITS) {
            for (let value of VALUES) {
                fullDeck.push(new Card(suit, value));
            }
        }

        // Remove known cards
        const knownCards = [...playerHand, ...communityCards];
        const remainingDeck = fullDeck.filter(c => 
            !knownCards.some(k => k.value === c.value && k.suit === c.suit)
        );

        let wins = 0;
        let ties = 0;

        for (let i = 0; i < iterations; i++) {
            const deck = [...remainingDeck]; 
            this.shuffle(deck);

            // Deal to opponents
            const oppHands = [];
            for (let j = 0; j < opponentCount; j++) {
                oppHands.push([deck.pop(), deck.pop()]);
            }

            // Deal remaining community cards
            const simCommunity = [...communityCards];
            while (simCommunity.length < 5) {
                simCommunity.push(deck.pop());
            }

            // Evaluate
            const myScore = HandEvaluator.evaluate(playerHand, simCommunity);
            
            let won = true;
            let tied = false;

            for (let oppHand of oppHands) {
                const oppScore = HandEvaluator.evaluate(oppHand, simCommunity);
                
                const cmp = this.compareScores(myScore, oppScore);
                if (cmp < 0) { // Lost to this opponent
                    won = false;
                    tied = false;
                    break;
                } else if (cmp === 0) {
                    tied = true;
                }
            }

            if (won) {
                if (tied) ties++;
                else wins++;
            }
        }

        return (wins + ties * 0.5) / iterations;
    }

    static shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    static compareScores(a, b) {
        // Returns >0 if a > b, <0 if a < b, 0 if equal
        if (a.rank !== b.rank) return a.rank - b.rank;
        for(let i=0; i<a.tieBreakers.length; i++) {
            if (a.tieBreakers[i] !== b.tieBreakers[i]) {
                return a.tieBreakers[i] - b.tieBreakers[i];
            }
        }
        return 0;
    }
}

class HandEvaluator {
    static evaluate(hand, community) {
        const allCards = [...hand, ...community];
        allCards.sort((a, b) => b.numValue - a.numValue);
        const flush = this.hasFlush(allCards);
        const straight = this.hasStraight(allCards);
        const counts = this.getCounts(allCards);
        const four = Object.keys(counts).find(key => counts[key] === 4);
        const three = Object.keys(counts).find(key => counts[key] === 3);
        const pairs = Object.keys(counts).filter(key => counts[key] === 2).sort((a,b) => b-a);

        if (flush && straight) {
            const suit = flush[0].suit;
            const flushCards = allCards.filter(c => c.suit === suit);
            const straightFlush = this.hasStraight(flushCards);
            if (straightFlush) return { rank: 9, name: "同花顺", tieBreakers: [straightFlush[0]] };
        }
        if (four) {
            const fourVal = parseInt(four);
            const kickers = allCards.filter(c => c.numValue !== fourVal).slice(0, 1).map(c => c.numValue);
            return { rank: 8, name: "四条", tieBreakers: [fourVal, ...kickers] };
        }
        if (three && pairs.length >= 1) {
            const threeVal = parseInt(three);
            const pairVal = parseInt(pairs[0]);
            return { rank: 7, name: "葫芦", tieBreakers: [threeVal, pairVal] };
        }
        const threes = Object.keys(counts).filter(key => counts[key] === 3).sort((a,b) => b-a);
        if (threes.length >= 2) return { rank: 7, name: "葫芦", tieBreakers: [parseInt(threes[0]), parseInt(threes[1])] };
        if (flush) return { rank: 6, name: "同花", tieBreakers: flush.slice(0, 5).map(c => c.numValue) };
        if (straight) return { rank: 5, name: "顺子", tieBreakers: [straight[0]] };
        if (three) {
            const threeVal = parseInt(three);
            const kickers = allCards.filter(c => c.numValue !== threeVal).slice(0, 2).map(c => c.numValue);
            return { rank: 4, name: "三条", tieBreakers: [threeVal, ...kickers] };
        }
        if (pairs.length >= 2) {
            const highPair = parseInt(pairs[0]);
            const lowPair = parseInt(pairs[1]);
            const kickers = allCards.filter(c => c.numValue !== highPair && c.numValue !== lowPair).slice(0, 1).map(c => c.numValue);
            return { rank: 3, name: "两对", tieBreakers: [highPair, lowPair, ...kickers] };
        }
        if (pairs.length === 1) {
            const pairVal = parseInt(pairs[0]);
            const kickers = allCards.filter(c => c.numValue !== pairVal).slice(0, 3).map(c => c.numValue);
            return { rank: 2, name: "一对", tieBreakers: [pairVal, ...kickers] };
        }
        return { rank: 1, name: "高牌", tieBreakers: allCards.slice(0, 5).map(c => c.numValue) };
    }
    static getCounts(cards) {
        const counts = {};
        cards.forEach(card => { counts[card.numValue] = (counts[card.numValue] || 0) + 1; });
        return counts;
    }
    static hasFlush(cards) {
        const suits = {};
        cards.forEach(card => {
            suits[card.suit] = (suits[card.suit] || []);
            suits[card.suit].push(card);
        });
        for (let suit in suits) {
            if (suits[suit].length >= 5) return suits[suit].sort((a,b) => b.numValue - a.numValue);
        }
        return null;
    }
    static hasStraight(cards) {
        const uniqueValues = [...new Set(cards.map(c => c.numValue))];
        uniqueValues.sort((a, b) => b - a);
        if (uniqueValues.includes(14)) uniqueValues.push(1);
        for (let i = 0; i < uniqueValues.length - 4; i++) {
            if (uniqueValues[i] - uniqueValues[i+4] === 4) return [uniqueValues[i]];
        }
        return null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OddsCalculator, HandEvaluator };
}
