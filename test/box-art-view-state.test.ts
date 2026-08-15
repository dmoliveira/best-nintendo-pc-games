import assert from "node:assert/strict";
import { test } from "node:test";
import { describeBoxView, INITIAL_BOX_VIEW_STATE, normalizeBoxAngle, reduceBoxView, snapBoxAngle } from "../lib/box-art/view-state";

test("package-view state rotates cyclically and bounds zoom", () => {
  let state = INITIAL_BOX_VIEW_STATE;
  state = reduceBoxView(state, "rotate-left");
  assert.equal(state.angle, 270);
  state = reduceBoxView(state, "rotate-right");
  assert.equal(state.angle, 0);
  state = reduceBoxView(state, "zoom-out");
  assert.equal(state.zoom, 1);
  state = reduceBoxView(state, "zoom-in");
  state = reduceBoxView(state, "zoom-in");
  state = reduceBoxView(state, "zoom-in");
  state = reduceBoxView(state, "zoom-in");
  assert.equal(state.zoom, 1.45);
  assert.equal(describeBoxView({ angle: 180, zoom: 1.3 }), "Back view, 130% zoom.");
  assert.deepEqual(reduceBoxView(state, "reset"), INITIAL_BOX_VIEW_STATE);
});

test("normalizes and snaps continuous drag angles to stable package views", () => {
  assert.equal(normalizeBoxAngle(-90), 270);
  assert.equal(normalizeBoxAngle(450), 90);
  assert.equal(snapBoxAngle(44.9), 0);
  assert.equal(snapBoxAngle(45), 90);
  assert.equal(snapBoxAngle(134.9), 90);
  assert.equal(snapBoxAngle(135), 180);
  assert.equal(snapBoxAngle(-46), 270);
  assert.equal(snapBoxAngle(-45), 0);
  assert.equal(snapBoxAngle(359.9), 0);
});
