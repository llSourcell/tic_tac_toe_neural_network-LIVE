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

var Neural = (function (Neural) {
    "use strict";

    function getSizes(nodes) {
        return nodes.map(function (layer) {
            return layer.length;
        });
    }

    function makeNode(layerIndex, index, sizes, nodes) {
        var node = {
            input: 0
        };

        if (layerIndex < sizes.length - 1) {
            node.threshold = (typeof nodes === 'undefined'
                ? 1
                : nodes[layerIndex][index].threshold
            );

            node.weights = (typeof nodes === 'undefined'
                ? new Array(sizes[layerIndex + 1])
                : nodes[layerIndex][index].weights.map(function (w) {
                    return w;
                })
            );
        }

        return node;
    }

    function Net(sizesOrNodes) {
        var sizes, nodes;
        if (Array.isArray(sizesOrNodes) && Array.isArray(sizesOrNodes[0])) {
            sizes = getSizes(sizesOrNodes);
            nodes = sizesOrNodes;
        }
        else {
            sizes = sizesOrNodes;
        }

        this.nodes = sizes.map(function (size, i) {
            var layer = new Array(size);
            for (var j = 0; j < size; ++j) {
                layer[j] = makeNode(i, j, sizes, nodes);
            }
            return layer;
        });
    }

    Net.prototype.eachNode = function Net_eachNode(visitOutput, callback) {
        var lastLayer = this.nodes.length - (visitOutput ? 0 : 1);
        for (var layerIndex = 0; layerIndex < lastLayer; ++layerIndex) {
            for (var i = 0; i < this.nodes[layerIndex].length; ++i) {
                callback(this.nodes[layerIndex][i], layerIndex, i, this.nodes);
            }
        }
    };

    Net.prototype.getSizes = function Net_getSizes() {
        return getSizes(this.nodes);
    };

    Net.prototype.getThresholds = function Net_getThresholds() {
        return this.nodes.map(function (layer, layerIndex) {
            return layer.map(function (node) {
                return node.threshold;
            });
        });
    };

    Net.prototype.getWeights = function Net_getWeights() {
        return this.nodes.map(function (layer, layerIndex) {
            return layer.map(function (node) {
                if (typeof node.weights === 'undefined') {
                    return [];
                }
                return node.weights.map(function (w) { return w; });
            });
        });
    };

    Net.prototype.setThresholds = function Net_setThresholds(thresholds) {
        this.eachNode(false, function (node, layerIndex, index) {
            node.threshold = thresholds[layerIndex][index];
        });
    };

    Net.prototype.setWeights = function Net_setWeights(weights) {
        this.eachNode(false, function (node, layerIndex, index) {
            node.weights = weights[layerIndex][index].map(function (w) {
                return w;
            });
        });
    };

    Net.prototype.reset = function Net_reset() {
        this.eachNode(true, function (node) {
            node.input = 0;
        });
    };

    Net.prototype.setInputs = function Net_setInputs(inputs) {
        this.nodes[0].forEach(function (node, index) {
            node.input = inputs[index];
        });
    };

    Net.prototype.run = function Net_run(inputs) {
        if (typeof inputs !== 'undefined') {
            this.setInputs(inputs);
        }

        this.eachNode(false, function (node, layerIndex, index, nodes) {
            if (node.input >= node.threshold) {
                for (var i = 0; i < node.weights.length; ++i) {
                    nodes[layerIndex + 1][i].input += node.weights[i];
                }
            }
        });

        return this.getOutputs();
    };

    Net.prototype.getOutputs = function Net_getOutputs() {
        return this.nodes[this.nodes.length - 1].map(function (node, index) {
            return node.input;
        });
    };

    Net.prototype.clone = function Net_clone() {
        return new Net(this.nodes);
    };

    Net.prototype.export = function Net_export() {
        return {
            thresholds: this.getThresholds(),
            weights: this.getWeights()
        };
    };

    Net.import = function Net_import(obj) {
        if (!Array.isArray(obj.thresholds) || !Array.isArray(obj.weights)) {
            throw new Error("Neural.Net.import() needs an object with Array "
                + "properties thresholds and weights"
            );
        }

        var net = new Net(getSizes(obj.thresholds));
        net.setThresholds(obj.thresholds);
        net.setWeights(obj.weights);
        return net;
    };

    Neural.Net = Net;

    return Neural;
}(Neural || {}));
