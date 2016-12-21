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

"use strict";

var generation;
var best;
var jumps;
var paused = false;
var workerCount = 4;
var generationSize = 100;
var individualSizes = [18, 27, 9, 1];
var mutationRate = 0.03;
var clonesPerGeneration = 3;
var workers = [];

// TODO: use seedrandom? <https://github.com/davidbau/seedrandom>

$(function () {
    var STORAGE_KEY = 'netttt.state';

    var $current = $('#current');
    var $time = $('#time');
    var $pauseButton = $('#pause');
    var $resetButton = $('#reset');
    var $workers = $('#workers');
    var $mutation = $('#mutation');
    var $generationBest = $('#generation-best');
    var $generationAverage = $('#generation-average');
    var $jumps = $('#jumps');
    var $bestExport = $('#best-export');
    var $clones = $('#clones');

    var receivedCount = 0;
    var beginTime = 0;
    var endTime = 0;
    var demos = [
        {
            ctx: $('#x-random-demo-board')[0].getContext('2d'),
            player: Ttt.X,
            opponent: new Ai.Random(),
            game: null
        },
        {
            ctx: $('#x-smart-demo-board')[0].getContext('2d'),
            player: Ttt.X,
            opponent: new Ai.Smart(),
            game: null
        },
        {
            ctx: $('#o-random-demo-board')[0].getContext('2d'),
            player: Ttt.O,
            opponent: new Ai.Random(),
            game: null
        },
        {
            ctx: $('#o-smart-demo-board')[0].getContext('2d'),
            player: Ttt.O,
            opponent: new Ai.Smart(),
            game: null
        }
    ];
    var demoTimerId = undefined;

    $workers.val(workerCount);
    $mutation.val(mutationRate);
    $clones.val(clonesPerGeneration);

    reset();

    function restore() {
        if (!localStorage[STORAGE_KEY]) {
            return false;
        }

        var obj = $.parseJSON(localStorage[STORAGE_KEY]);

        generation = Genetic.Generation.import(obj.generation);
        best = copyBest(obj.best, true);
        jumps = obj.jumps.map(function (j) { return copyBest(j, true); });
        return true;
    }

    function save() {
        localStorage[STORAGE_KEY] = JSON.stringify({
            generation: generation.export(),
            best: copyBest(best, false),
            jumps: jumps.map(function (j) { return copyBest(j, false); })
        });
    }

    function copyBest(b, import_) {
        return {
            score: b.score,
            age: b.age,
            id: b.id,
            generation: b.generation,
            net: (import_ ? Neural.Net.import(b.net) : b.net.export())
        };
    }

    function clear() {
        delete localStorage[STORAGE_KEY];
    }

    function reset() {
        if (!restore()) {
            generation = Genetic.Generation.newRandom(generationSize, individualSizes);
            best = null;
            jumps = [];
        }

        updateScores(true);
        update();
        run();
    }

    function update() {
        $current.text($current.data(paused ? (receivedCount < workers.length ? 'pausing' : 'paused') : 'unpaused')
            .replace('{generation}', generation.id.toString())
        );
        if (endTime > beginTime) {
            $time.text($time.data('template').replace('{time}', Math.round(endTime - beginTime)));
        }
        $pauseButton.val($pauseButton.data(paused ? 'paused' : 'unpaused'));
        if (paused && receivedCount < workers.length) {
            $pauseButton.attr('disabled', true);
        }
        else {
            $pauseButton.removeAttr('disabled');
        }

        if (paused && receivedCount === workers.length) {
            $resetButton.removeAttr('disabled');
        }
        else {
            $resetButton.attr('disabled', true);
        }
    }

    function updateScores(bestChanged, generationBest, generationAverage) {
        $jumps.empty();
        $jumps.append(jumps.map(function (j) {
            return $($jumps.data('template')
                .replace('{score}', j.score.toString())
                .replace('{age}', j.age.toString())
                .replace('{id}', j.id.toString())
                .replace('{generation}', j.generation.toString())
            );
        }));

        if (bestChanged) {
            $bestExport.text(best ? JSON.stringify(best.net.export()) : '');

            resetDemos();
        }

        $generationBest.text(typeof generationBest === 'undefined'
            ? $generationBest.data('empty')
            : $generationBest.data('template')
                .replace('{score}', generationBest.score.toString())
                .replace('{age}', generationBest.age.toString())
                .replace('{id}', generationBest.id.toString())
        );
        $generationAverage.text(typeof generationAverage === 'undefined'
            ? $generationAverage.data('empty')
            : $generationAverage.data('template')
                .replace('{score}', generationAverage.toFixed(1))
        );
    }

    function run() {
        if (paused) {
            return;
        }

        adjustWorkers();

        receivedCount = 0;
        beginTime = window.performance.now();

        workers.forEach(function (w, i) {
            w.postMessage(generation.export({
                index: i,
                total: workers.length
            }));
        });
    }

    function adjustWorkers() {
        if (workers.length > workerCount) {
            var excess = workers.length - workerCount;
            workers.splice(-excess, excess);
        }
        else if (workers.length < workerCount) {
            for (var i = workers.length; i < workerCount; ++i) {
                workers[i] = new Worker('main.worker.js');

                workers[i].onmessage = function (event) {
                    process(event.data);
                };
            }
        }
    }

    function process(data) {
        if (data.generation !== generation.id) {
            throw new Error("Worker shenanigans");
        }

        data.scores.forEach(function (s) {
            generation.individuals[s.id].age = s.age;
            generation.individuals[s.id].score = s.score;
        });

        if (++receivedCount === workers.length) {
            finishRun();
        }
    }

    function finishRun() {
        generation.individuals.forEach(function (i) {
            if (i.age === -Infinity || i.score === -Infinity) {
                throw new Error("Received incomplete result");
            }
        });

        generation.order();
        endTime = window.performance.now();

        score();

        generation = generation.next(mutationRate, clonesPerGeneration);

        save();
        update();
        run();
    }

    function setPaused(p) {
        if (p !== paused) {
            paused = p;

            update();
            run();
        }
    }

    function score() {
        var bestChanged = false;
        // HACK: we're comparing an individual to a "best", but it works.
        if (!best || generation.individuals[0].compareTo(best) > 0) {
            best = {
                score: generation.individuals[0].score,
                age: generation.individuals[0].age,
                id: generation.individuals[0].id,
                generation: generation.id,
                net: generation.individuals[0].net
            };
            jumps.push(best);

            bestChanged = true;
        }

        var sum = 0;
        generation.individuals.forEach(function (i) {
            sum += i.score;
        });

        updateScores(bestChanged, generation.individuals[0],
            sum / generation.individuals.length
        );
    }

    function resetDemos() {
        if (typeof demoTimerId !== 'undefined') {
            window.clearInterval(demoTimerId);
        }
        if (best) {
            demoTimerId = window.setInterval(updateDemos, 1000);
        }

        demos.forEach(function (d) {
            d.game = new Ttt.Game();
        });
        drawDemos();
    }

    function updateDemos() {
        demos.forEach(function (d) {
            if (d.game.winner()) {
                d.game = new Ttt.Game();
                return;
            }

            var ai = (d.game.turn === d.player
                ? new Ai.Neural(best.net)
                : d.opponent
            );
            d.game.move(ai.getMove(d.game));
        });
        drawDemos();
    }

    function drawDemos() {
        demos.forEach(function (d) {
            (d.game ? d.game : new Ttt.Game()).draw(d.ctx);
        });
    }

    $pauseButton.click(function (event) {
        setPaused(!paused);
    });

    $resetButton.click(function (event) {
        clear();
        reset();
    });

    function inputChanged($item, parse, min, max, default_) {
        var x = parse($item.val());
        if (isNaN(x)) {
            x = default_;
        }
        else if (x < min) {
            x = min;
        }
        else if (x > max) {
            x = max;
        }
        $item.val(x);
        return x;
    }

    function parseInt10(s) {
        return parseInt(s, 10);
    }

    $workers.change(function (event) {
        workerCount = inputChanged($workers, parseInt10, 1, 16, 4);
    });

    $mutation.change(function (event) {
        mutationRate = inputChanged($mutation, parseFloat, 0.0001, 0.1, 0.01);
    });

    $clones.change(function (event) {
        clonesPerGeneration = inputChanged($clones, parseInt10, 0, 20, 5);
    });
});
