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

(function (global) {
    "use strict";

    importScripts('src/ttt.js', 'src/neural.js', 'src/ai.js', 'src/genetic.js');

    global.onmessage = function (event) {
        var result = process(event.data);
        postMessage(result);
    };

    function process(data) {
        var generation = Genetic.Generation.import(data);
        generation.run();
        return exportResult(generation);
    }

    function exportResult(generation) {
        return {
            generation: generation.id,
            scores: generation.individuals.map(function (i) {
                return {
                    id: i.id,
                    age: i.age,
                    score: i.score
                };
            })
        };
    }
}(this));
