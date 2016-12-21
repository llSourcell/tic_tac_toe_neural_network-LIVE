/*
   netttt - evolving neural networks to play tic tac toe
            <https://chazomaticus.github.io/netttt/>
   Copyright 2013 Charles Lindsay

   netttt is free software: you can redistribute it and/or modify it under the
   terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version.

   netttt is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
   FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
   details.

   You should have received a copy of the GNU General Public License along with
   netttt.  If not, see <http://www.gnu.org/licenses/>.
*/

var Genetic = (function (Genetic) {
    "use strict";

    var testBoards = null;

    // We want to test our neural nets against the smart AI for every relevant
    // board, which is every board where there's more than one valid move to be
    // made.  This returns an array, keyed by how many pieces are filled in,
    // of arrays of boards.  We also cache the correct moves, according to the
    // smart AI, for each board so we don't have to look it up more than once.
    function generateTestBoards(boards, visited, game) {
        boards = boards || [[], [], [], [], [], [], [], []];
        visited = visited || {};
        game = game || new Ttt.Game();

        var emptySquares = game.emptySquares();

        if (visited[game.board] || game.winner() || emptySquares.length <= 1) {
            return boards;
        }

        boards[9 - emptySquares.length].push({
            board: game.board,
            rightMoves: null
        });
        visited[game.board] = true;

        emptySquares.forEach(function (move) {
            game.move(move);
            generateTestBoards(boards, visited, game);
            game.undo();
        });

        return boards;
    }

    function Individual(id, net) {
        this.id = id;
        this.net = net;
        this.age = -Infinity;
        this.score = -Infinity;
    }

    Individual.AGE_MAX = 8; // 8 is the length of testBoards.
    Individual.SCORE_MAX = 4298; // 4298 = sum of array lengths in testBoards.

    // By age, then score.
    Individual.compare = function Individual_compare(a, b) {
        if (a.age !== b.age) {
            return a.age - b.age;
        }
        return a.score - b.score;
    };

    Individual.compareDescending = function Individual_compareDescending(a, b
    ) {
        return Individual.compare(b, a);
    };

    Individual.prototype.compareTo = function Individual_compareTo(other) {
        return Individual.compare(this, other);
    };

    Individual.prototype.evaluateOne = function Individual_evaluateOne(b) {
        var game = new Ttt.Game(b.board);
        if (!b.rightMoves) {
            b.rightMoves = new Ai.Smart().getMoves(game);
        }

        var anyRight = false;
        var anyWrong = false;
        new Ai.Neural(this.net).getMoves(game).forEach(function (move) {
            if (b.rightMoves.indexOf(move) >= 0) {
                anyRight = true;
            }
            else {
                anyWrong = true;
            }
        });

        if (anyRight && !anyWrong) {
            this.score++;
        }

        return !anyWrong;
    };

    Individual.prototype.evaluate = function Individual_evaluate() {
        testBoards = testBoards || generateTestBoards();

        this.score = 0;

        var failedDepth = -1;
        testBoards.every(function (boards, depth) {
            boards.forEach(function (b) {
                if (!this.evaluateOne(b) && failedDepth < 0) {
                    failedDepth = depth;
                }
            }, this);

            // We go at least to boards with 3 moves to differentiate between
            // results at the same age.  There are 334 possible scores before
            // boards with 4 moves, which should be plenty for 100 individuals.
            return (failedDepth < 0 || depth < 3);
        }, this);

        this.age = (failedDepth < 0 ? testBoards.length : failedDepth);
    };

    Individual.prototype.clone = function Individual_clone(id) {
        return new Individual(id, this.net.clone());
    };

    function heads() {
        return Math.random() < 0.5;
    }

    function splice(dest, source) {
        if (dest === source) {
            return;
        }

        dest.eachNode(false, function (node, layerIndex, index) {
            if (heads()) {
                node.threshold = source.nodes[layerIndex][index].threshold;
            }
            for (var i = 0; i < node.weights.length; ++i) {
                if (heads()) {
                    node.weights[i]
                        = source.nodes[layerIndex][index].weights[i]
                    ;
                }
            }
        });
    }

    Individual.prototype.reproduce = function Individual_reproduce(id, other) {
        var child = this.clone(id);
        splice(child.net, other.net);
        return child;
    };

    function realRand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function intRand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomizeValue(v, modifyChance, minPerturb, maxPerturb) {
        if (Math.random() < modifyChance) {
            v += realRand(minPerturb, maxPerturb);
        }
        return v;
    }

    function randomize(
        net, modifyChance, minThresh, maxThresh, minWeight, maxWeight
    ) {
        modifyChance = (typeof modifyChance === 'undefined'
            ? 0.01
            : modifyChance
        );
        minThresh = minThresh || -100;
        maxThresh = maxThresh || 100;
        minWeight = minWeight || -10;
        maxWeight = maxWeight || 10;

        net.eachNode(false, function (node) {
            node.threshold = randomizeValue(
                node.threshold, modifyChance, minThresh, maxThresh
            );
            for (var i = 0; i < node.weights.length; ++i) {
                node.weights[i] = randomizeValue(
                    node.weights[i] || 0, modifyChance, minWeight, maxWeight
                );
            }
        });
        return net;
    }

    Individual.newRandom = function Individual_newRandom(id, sizes) {
        return new Individual(id, randomize(new Neural.Net(sizes), 1));
    }

    Individual.prototype.mutate = function Individual_mutate(mutationRate) {
        randomize(this.net, mutationRate);
        return this;
    };

    Individual.prototype.export = function Individual_export() {
        return {
            id: this.id,
            net: this.net.export()
        };
    };

    Individual.import = function Individual_import(obj) {
        if (typeof obj.id === 'undefined' || typeof obj.net === 'undefined') {
            throw new Error("Genetic.Individual.import() needs an object with "
                + "properties id and net"
            );
        }

        var id = obj.id;
        var net = Neural.Net.import(obj.net);
        var sizes = net.getSizes();
        if (sizes.length < 1 || sizes[0] !== 18
            || sizes[sizes.length - 1] !== 1
        ) {
            throw new Error("Genetic.Individual.import() needs a "
                + "Neural.Net.import() object with 18 input layer nodes and 1 "
                + "output layer node"
            );
        }

        return new Individual(id, net);
    };

    function Generation(id, individuals) {
        this.id = id || 0;
        // Allow the individuals to specify their own ids so our workers don't
        // munge the ids from the main thread.
        this.individuals = individuals;
    }

    Generation.prototype.run = function Generation_run() {
        this.individuals.forEach(function (i) {
            i.evaluate();
        });
    };

    Generation.prototype.order = function Generation_order() {
        // Shuffle individuals before sorting, to randomize the order of nets
        // with the same score.
        for (var i = this.individuals.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = this.individuals[i];
            this.individuals[i] = this.individuals[j];
            this.individuals[j] = t;
        }

        this.individuals.sort(Individual.compareDescending);
    };

    function select(pool) {
        var x = Math.random();
        x = x * x; // Bias the selection toward 0.

        return pool[Math.floor(x * pool.length)];
    }

    Generation.prototype.next = function Generation_next(
        mutationRate, clones, id
    ) {
        mutationRate = mutationRate || 0.05;
        clones = (typeof clones === 'undefined' ? 0 : clones);
        id = id || this.id + 1;

        var oldIndividuals = this.individuals;
        var newIndividuals = [];
        var i;

        for (i = 0; i < clones; ++i) {
            newIndividuals.push(
                oldIndividuals[i].clone(newIndividuals.length)
            );
        }

        while (newIndividuals.length < oldIndividuals.length) {
            var a = select(oldIndividuals);
            var b = select(oldIndividuals);
            newIndividuals.push(
                a.reproduce(newIndividuals.length, b).mutate()
            );
        }

        return new Generation(id, newIndividuals);
    }

    Generation.newRandom = function Generation_newRandom(
        size, sizes, id, imported
    ) {
        size = size || 100;
        sizes = sizes || [18, 27, 9, 1];
        id = id || 0;
        imported = imported || [];

        var individuals = new Array(size);
        var i;
        for (i = 0; i < imported.length; ++i) {
            individuals[i] = imported[i];
            individuals[i].id = i;
        }
        for (; i < size; ++i) {
            individuals[i] = Individual.newRandom(i, sizes);
        }
        return new Generation(id, individuals);
    }

    Generation.prototype.export = function Generation_export(chunk) {
        if (typeof chunk === 'undefined') {
            chunk = {
                index: 0,
                total: 1
            };
        }

        var size = this.individuals.length / chunk.total;
        return {
            id: this.id,
            individuals: this.individuals.slice(
                Math.round(chunk.index * size),
                Math.round((chunk.index + 1) * size)
            ).map(function (i) { return i.export(); })
        };
    }

    Generation.import = function Generation_import(obj) {
        if (typeof obj.id === 'undefined' || !Array.isArray(obj.individuals)) {
            throw new Error("Genetic.Individual.import() needs an object with "
                + "properties id and Array individuals"
            );
        }

        var id = obj.id;
        var individuals = obj.individuals;

        return new Generation(id, individuals.map(function (i) {
            return Individual.import(i);
        }));
    }

    Genetic.Individual = Individual;
    Genetic.Generation = Generation;

    return Genetic;
}(Genetic || {}));
