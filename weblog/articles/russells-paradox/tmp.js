(function russell() {
  var dragEl = document.getElementById('ref-s');
  var setEl = document.getElementById('set-s');
  var extraordinaryButton = document.getElementById(
    'set-designation-extraordinary'
  );
  var ordinaryButton = document.getElementById('set-designation-ordinary');
  var sContainsAllOrdinaryEl = document.getElementById(
    's-contains-all-ordinary-condition'
  );
  var sDesignationHoldsUpEl = document.getElementById(
    'set-designation-condition'
  );

  var dragging = false;

  var lastPageX;
  var lastPageY;

  dragEl.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);

  dragEl.addEventListener('touchstart', onMouseDown);
  window.addEventListener('touchend', onMouseUp);
  window.addEventListener('touchcancel', onMouseUp);
  window.addEventListener('touchmove', onMouseMove);

  extraordinaryButton.addEventListener('click', onSetDesignationClick);
  ordinaryButton.addEventListener('click', onSetDesignationClick);

  function onMouseDown(e) {
    e.preventDefault();
    dragging = true;
    console.log('dragging', dragging);
    dragEl.classList.add('selected');
  }

  function onMouseUp(e) {
    e.preventDefault();
    dragging = false;
    console.log('dragging', dragging);
    dragEl.classList.remove('selected');
    setEl.classList.remove('aura');

    passStateFromUIToEvaluate();
  }

  function onMouseMove(e) {
    //e.preventDefault();

    if (!dragging) {
      return;
    }

    console.log('e.pageX', e.pageX);
    if (lastPageX === undefined || lastPageY === undefined) {
      lastPageX = e.pageX;
      lastPageY = e.pageY;
      return;
    }

    const deltaX = e.pageX - lastPageX;
    const deltaY = e.pageY - lastPageY;

    // Chop off 'px' from string.
    const oldX = +dragEl.style.getPropertyValue('left').slice(0, -2);
    const oldY = +dragEl.style.getPropertyValue('top').slice(0, -2);

    const newX = oldX + deltaX;
    const newY = oldY + deltaY;

    console.log(
      'oldX',
      oldX,
      'oldY',
      oldY,
      'deltaX',
      deltaX,
      'deltaY',
      deltaY,
      'newX',
      newX,
      'newY',
      newY
    );

    dragEl.style.setProperty('left', newX + 'px');
    dragEl.style.setProperty('top', newY + 'px');

    lastPageX = e.pageX;
    lastPageY = e.pageY;

    // Could optimize this with a flag instead of always changing class.
    if (elOverlapsEl(dragEl, setEl)) {
      setEl.classList.add('aura');
    } else {
      setEl.classList.remove('aura');
    }
  }

  function onSetDesignationClick() {
    passStateFromUIToEvaluate();
  }

  function passStateFromUIToEvaluate() {
    evaluateConditions({
      refIsInSet: elOverlapsEl(dragEl, setEl),
      sDesignation: extraordinaryButton.checked ? 'extraordinary' : 'ordinary'
    });
  }

  function evaluateConditions({ refIsInSet, sDesignation }) {
    var sContainsAllOrdinarySets;
    if (sDesignation === 'ordinary') {
      sContainsAllOrdinarySets = true; // TODO: If ref is in the set, then the set needs to automatically be designated extraordinary!
    } else {
      sContainsAllOrdinarySets = !refIsInSet;
    }

    var sDesignationHoldsUp;

    if (sDesignation === 'ordinary') {
      sDesignationHoldsUp = !refIsInSet;
    } else {
      // If it is designated an extraordinary set, then
      // it has to have at least one reference to a set in it.
      sDesignationHoldsUp = refIsInSet;
    }

    const conditionTextHTML = `S is an ${sDesignation} set (<strong>is${
      sDesignation === 'extraordinary' ? ' not' : ''
    } </strong> an element of itself):`;

    updateConditionEl({
      verdict: sContainsAllOrdinarySets,
      parent: sContainsAllOrdinaryEl
    });
    updateConditionEl({
      descriptionHTML: conditionTextHTML,
      verdict: sDesignationHoldsUp,
      parent: sDesignationHoldsUpEl
    });
  }

  function updateConditionEl({ verdict, parent, descriptionHTML }) {
    parent.classList[verdict ? 'add' : 'remove']('condition-passed');
    if (descriptionHTML) {
      let desc = document.querySelector(`#${parent.id} .description`);
      if (desc) {
        desc.innerHTML = descriptionHTML;
      }
    }
  }

  function elOverlapsEl(el1, el2) {
    var bounds1 = el1.getBoundingClientRect();
    var bounds2 = el2.getBoundingClientRect();

    var left1IsInsideEl2,
      right1IsInsideEl2,
      top1IsInsideEl2,
      bottom1IsInsideEl2;

    left1IsInsideEl2 = nIsInsideRange(
      bounds1.left,
      bounds2.left,
      bounds2.right
    );
    if (!left1IsInsideEl2) {
      right1IsInsideEl2 = nIsInsideRange(
        bounds1.right,
        bounds2.left,
        bounds2.right
      );
    }

    top1IsInsideEl2 = nIsInsideRange(bounds1.top, bounds2.top, bounds2.bottom);
    if (!top1IsInsideEl2) {
      bottom1IsInsideEl2 = nIsInsideRange(
        bounds1.bottom,
        bounds2.top,
        bounds2.bottom
      );
    }

    return (
      (left1IsInsideEl2 || right1IsInsideEl2) &&
      (top1IsInsideEl2 || bottom1IsInsideEl2)
    );
  }

  function nIsInsideRange(n, lower, upper) {
    return n >= lower && n <= upper;
  }
})();
