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

var game;
var ais;
var aiDelay = 1000;
var paused = false;

$(function () {
    ais = {};
    ais[Ttt.X] = null;
    ais[Ttt.O] = null;

    var $board = $('#board');
    var $status = $('#status');
    var $xControl = $('#x-control');
    var $xAiNeuralImport = $('#x-ai-neural-import');
    var $oControl = $('#o-control');
    var $oAiNeuralImport = $('#o-ai-neural-import');
    var $pauseButton = $('#pause');
    var $stepButton = $('#step');
    var $undoButton = $('#undo');
    var $restartButton = $('#restart');

    var boardCtx = $board[0].getContext('2d');
    var aiTimerId = undefined;

    restart();

    function restart() {
        game = new Ttt.Game();
        update();
    }

    function update() {
        cancelAiMove();

        redraw();

        switch (game.winner()) {
        case Ttt.X: $status.text($status.data('winner-x')); break;
        case Ttt.O: $status.text($status.data('winner-o')); break;
        case Ttt.TIE: $status.text($status.data('tie')); break;
        default:
            if (ais[game.turn] && paused) {
                $status.text($status.data('paused'));
            }
            else {
                clearStatus();
            }
            break;
        }

        if ($xControl.val() === 'ai-neural') $xAiNeuralImport.removeAttr('disabled');
        else $xAiNeuralImport.attr('disabled', true);
        if ($oControl.val() === 'ai-neural') $oAiNeuralImport.removeAttr('disabled');
        else $oAiNeuralImport.attr('disabled', true);

        $pauseButton.val($pauseButton.data(paused ? 'paused' : 'unpaused'));

        scheduleAiMove();
    }

    function clearStatus() {
        $status.text($status.data('empty'));
    }

    function redraw(highlightPiece) {
        game.draw(boardCtx, $board.width(), $board.height(), 0, 0, highlightPiece);
    }

    function setPaused(p) {
        if (p !== paused) {
            paused = p;
            update();
        }
    }

    function move(square) {
        game.move(square);
        update();
    }

    function undo() {
        if (game.history.length > 0) {
            game.undo();
            update();
        }
    }

    function scheduleAiMove() {
        if (typeof aiTimerId === 'undefined' && game.winner() === 0 && ais[game.turn] && !paused) {
            aiTimerId = window.setInterval(makeAiMove, aiDelay);
            $status.text($status.data('thinking'));
        }
    }

    function cancelAiMove() {
        if (typeof aiTimerId !== 'undefined') {
            window.clearInterval(aiTimerId);
            aiTimerId = undefined;
            clearStatus();
        }
    }

    function makeAiMove() {
        cancelAiMove();

        if (ais[game.turn] && game.winner() === 0) {
            var square = ais[game.turn].getMove(game);
            if (game.getPiece(square) !== 0) {
                throw new Error(
                    "AI chose invalid move " + square.toString()
                    + " in " + game.toString()
                );
            }
            move(square);
        }
    }

    function setAi(turn, ai) {
        ais[turn] = ai;
        update();
    }

    function setAiFromSelect(turn) {
        var ai = null;
        switch ((turn === Ttt.X ? $xControl : $oControl).val()) {
        case 'ai-random': ai = new Ai.Random(); break;
        case 'ai-easy': ai = new Ai.Smart(1); break;
        case 'ai-smart': ai = new Ai.Smart(); break;
        case 'ai-neural':
            var importBox = (turn === Ttt.X ? $xAiNeuralImport : $oAiNeuralImport);
            if (importBox.val().length > 0) {
                try {
                    var obj = $.parseJSON(importBox.val());
                    var net = Neural.Net.import(obj);
                    ai = new Ai.Neural(net);
                }
                catch (e) {
                    console.log(e.toString());
                    alert(e.toString());
                }
            }
            break;
        }
        setAi(turn, ai);
    }

    function getSquare(x, y) {
        var col = (x - $board.offset().left) / $board.width() * 3 | 0;
        var row = (y - $board.offset().top) / $board.height() * 3 | 0;
        return col + row * 3;
    }

    $board.mousemove(function (event) {
        if (!ais[game.turn] && game.winner() === 0) {
            redraw(getSquare(event.pageX, event.pageY));
        }
    });

    $board.mouseleave(function (event) {
        if (!ais[game.turn] && game.winner() === 0) {
            redraw();
        }
    });

    $board.click(function (event) {
        var square = getSquare(event.pageX, event.pageY);
        if (!ais[game.turn] && game.winner() === 0 && game.getPiece(square) === 0) {
            move(square);
        }
    });

    $xControl.change(function (event) {
        setAiFromSelect(Ttt.X);
    });

    $xAiNeuralImport.change(function (event) {
        setAiFromSelect(Ttt.X);
    });

    $oControl.change(function (event) {
        setAiFromSelect(Ttt.O);
    });

    $oAiNeuralImport.change(function (event) {
        setAiFromSelect(Ttt.O);
    });

    $pauseButton.click(function (event) {
        setPaused(!paused);
    });

    $stepButton.click(function (event) {
        makeAiMove();
    });

    $undoButton.click(function (event) {
        undo();
    });

    $restartButton.click(function (event) {
        restart();
    });
});
