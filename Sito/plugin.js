function sanitizeID(value){
  var tmp = value.toFixed().length;
  var ret = '';
  for (var i = 5; i > tmp; i--) {ret += '0';}
  return ret + value;
}

function getTime(){ return (new Date().toJSON()); }

// mette il num nel range tra 0 e max per far stare il range dentro il contenuto
function sanitize(num, max){ num = num < 0 ? 0 : num; num = num > max ? max : num; return num; }

const delay = ms => new Promise(res => setTimeout(res, ms));

function isMainNode(node){ return(Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(node)); }

function goToMainNode(node){
  while (!isMainNode(node)) node = node.parentNode;
  return node;
}

function stepBackNode(node) {
  if (tinyMCE.activeEditor.dom.doc.body == node) return node;
  else if (node.previousSibling != undefined) node = node.previousSibling;
  else node = stepBackNode(node.parentNode);
  return node;
}

function stepNextNode(node) {
  if (tinyMCE.activeEditor.dom.doc.body == node) return node;
  else if (node.nextSibling != undefined) node = node.nextSibling;
  else node = stepBackNode(node.parentNode);
  return node;
}

// INS, DEL
class Mechanical {
  constructor(){
    this.editMech = 0;
    this.stackMech = [];
    this.revertedMech = [];
  }

  insItem(item){ this.stackMech.push(item); }

  createItem(op, pos, content, by, map){
    var item = {
      id: "mech-" + sanitizeID(this.editMech),
      op: op,
      pos: pos,
      content: content,
      by: by,
      timestamp: getTime(),
      map: map // serve dell'undo per mettere il cursore esattamente dove stava
    };
    this.editMech++;
    return item;
  }

  get stack() { return(this.stackMech); }
  get revertedstack() {return(this.revertedMech);}

  remItem(i) {
    var item = this.stackMech.splice(i,1)[0];
    this.revertedMech[this.revertedMech.length] = item;
    return(item);
  }

  remRevert(i){ return(this.revertedMech.splice(i,1)[0]); }
  emptyRevertedMech() { this.revertedMech = []; }
}

/* ----- */
// INIT CLASS and VAR
oldState = undefined;
var by = "";
var mech = new Mechanical();
var ed;

// Cattura lo stato
function catchState() { return(tinyMCE.activeEditor.dom.doc.body.innerHTML); }

// Carica lo stato
function loadState(state) { ed.innerHTML = state; oldState = state; }

// Cerca il cambiamento nella stringa e lo salva
function catchChange(pos, map){
  newState = catchState();

  if (oldState == undefined) { oldState = newState; console.log('State Loaded'); }
  else if (oldState == newState) { console.log('State Unchanged'); }
  else {
    // Controllo da sinistra verso destra
    var start = sanitize(pos.start, Math.min(oldState.length, newState.length));
    while ( start < newState.length && newState[start] == oldState[start] ) { start ++; }

    // Controllo da destra verso sinistra
    var newEnd = newState.length -1 - pos.end; // Se c'è stato quache cambiamento allora è probabile che la lunghezza tra le 2 stringhe è cambiata
    var oldEnd = oldState.length -1 - pos.end; // Se c'è stato quache cambiamento allora è probabile che la lunghezza tra le 2 stringhe è cambiata
    while ( newEnd >= start && oldEnd >= start && newState[newEnd] == oldState[oldEnd]) { newEnd --; oldEnd --;}

    if (start < newState.length) { // Se c'è stato un cambiamento
      // da inserire il le modifiche di tipo strutturale
      let del = oldState.slice(start,oldEnd+1);
      let add = newState.slice(start,newEnd+1);
      mech.insItem(mech.createItem("DEL", start, del, by, map));
      mech.insItem(mech.createItem("INS", start, add, by, createMap()));
      mech.emptyRevertedMech();   // Se si fanno delle modifiche la coda con gli undo annulati va svuotata

      // Righe per fare un log carino
      var dl = del, ad = add, range = 30;
      if (del.length > range) dl = del.slice(0,range/2) + "..." + del.slice(del.length -1 -(range/2), del.length -1);
      if (add.length > range) ad = add.slice(0,range/2) + "..." + add.slice(add.length -1 -(range/2), add.length -1);
      console.log(`State Changed "%c${dl}%c" into "%c${ad}%c"`,"color: red","","color: red","");
    }

    oldState = newState;
  }
}

// Ottieni il blocco della stringa in base alla pos del puntatore
function getAbsPos(sc) {
  var r = tinyMCE.activeEditor.selection.getRng().cloneRange();

  var startContainer = sc==undefined? r.startContainer : sc;
  var endContainer = r.endContainer;

  // Calcolo start
  let start = 0;
  var walker = stepBackNode(goToMainNode(startContainer));
  while (walker != null && !Array.from(ed.parentNode.children).includes(walker)){
    if (walker.outerHTML != undefined) start += walker.outerHTML.length; // Se sono dentro un nodo che ne contiene altri, non ha senso che entro nei sottonodi, prendo la lunghezza totale
    else start += walker.nodeValue.length; // Altrimenti se sono dentro un nodo testo prendo la lungezza della stringa
    walker = stepBackNode(walker);
  }

  let end = 0;
  var walker = stepNextNode(goToMainNode(endContainer));

  while (walker != null && !Array.from(ed.parentNode.children).includes(walker)){
    console.log(walker);
    if (walker.outerHTML != undefined) end += walker.outerHTML.length;
    else end += walker.nodeValue.length;
    walker = stepNextNode(walker);
  }

  // Righe per fare un log carino
  var rng = 3;
  var state = catchState(), stateLen = state.length-1, endP =  stateLen - end;
  console.log(`Range is from pos %c${start}%c "%c${state.slice(sanitize(start-rng, stateLen), start) + "%c|%c" + state[start] + "%c|%c" + state.slice(sanitize(start+1, stateLen), sanitize(start+rng+1,stateLen))}%c" to pos %c${endP}%c "%c${state.slice(sanitize(endP-rng, stateLen), endP) + "%c|%c" + state[endP] + "%c|%c" + state.slice(sanitize(endP+1, stateLen), sanitize(endP+rng+1,stateLen))}%c"`,"font-weight: bold","","color: red","color: grey","color: red","color: grey","color: red","","font-weight: bold","","color: red","color: grey","color: red","color: grey","color: red","")

  return ({ start: start, end: end });
}

// Se viende scatenato prende le ultime due modifiche scritte nella pila scelta in base al tipo (UNDO o REUNDO) e le applica
function revertChange(type) {
  // Se la pila è vuota undoChange non deve fare nulla
  if (type == "UNDO" && mech.stack.length == 0) {
    console.log("Undo stack is empty");
  }
  else if (type == "REDO" && mech.revertedstack.length == 0) {
    console.log("Redo stack is empty");
  }
  else {
    state = catchState();
    var add, rem;

    for (var i = 0; i < 2; i++) {
      if (type == "UNDO"){
        item = mech.remItem(mech.stackMech.length - 1);
        if (item.op == "INS") {
          state = state.slice(0, item.pos) + state.slice(item.pos + item.content.length);
          rem = item;
        }
        else if (item.op == "DEL") {
          state = state.slice(0, item.pos) + item.content + state.slice(item.pos);
          add = item;
        }
      }
      else if (type == "REDO"){
        item = mech.remRevert(mech.revertedstack.length - 1);
        if (item.op == "INS") {
          state = state.slice(0, item.pos) + item.content + state.slice(item.pos);
          mech.insItem(item);
          add = item;
        }
        else if (item.op == "DEL") {
          state = state.slice(0, item.pos) + state.slice(item.pos + item.content.length);
          mech.insItem(item);
          rem = item;
        }
      }
    }

    loadState(state);
    setCursorPos(add.map);
    console.log(`Added "%c${add.content}%c" and Removed "%c${rem.content}%c"`,"color: red","","color: red","");
  }
}

// Mette il cursore sul dom
function setCursorPos(map){
  ed.focus();

  var start = navigateMap(map.start);
  var end = navigateMap(map.end);

  var sSize = start.node.innerText != null ? start.node.innerText.length : start.node.valueOf().length;
  var eSize = end.node.innerText != null ? end.node.innerText.length : end.node.valueOf().length;

  r = tinyMCE.activeEditor.selection.getRng();
  r.setStart(start.node, sanitize(start.offset, sSize));
  r.setEnd(end.node, sanitize(end.offset, eSize));
}

// Crea la mappa per essere percorsa da setCursorPos
function createMap() {
  function genBracket(node, offset){
    var map = {child: null, offset: offset};
    do {
      let index = Array.from(node.parentNode.childNodes).findIndex((elem) => elem == node);
      map = {child: map, offset: index};
      node = node.parentNode;
    } while (node != ed);
    return (map);
  }

  var ret = {};
  var r = tinyMCE.activeEditor.selection.getRng().cloneRange();
  ret.start = genBracket(r.startContainer, r.startOffset);
  ret.end = genBracket(r.endContainer, r.endOffset);

  return ret;
}

function navigateMap(map){
  var node = ed;
  while (map.child != null){
    node = node.childNodes[map.offset];
    map = map.child;
  }
  return {node: node, offset: map.offset};
}

tinymce.PluginManager.add('UndoStack', function(editor, url) {
  editor.on('BeforeAddUndo', function(e) {
    // Disabilita l'undo built in
    return false;
  });

  editor.ui.registry.addButton('Custom-Undo', {
    text: 'Undo',
    icon: 'undo',
    tooltip: 'CTRL + Z',
    onAction: function () {
      revertChange("UNDO");
    }
  });
  editor.shortcuts.add('ctrl+z', "Undo Pc shortcut", function() { revertChange("UNDO"); });
  editor.shortcuts.add('command+z', "Undo Mac shortcut", function() { revertChange("UNDO"); });


  editor.ui.registry.addButton('Custom-Redo', {
    text: 'Redo',
    icon: 'redo',
    tooltip: 'CTRL + SHIFT + Z',
    onAction: function () {
      revertChange("REDO");
    }
  });
  editor.shortcuts.add('ctrl+y', "Redo Pc shortcut", function() { revertChange("REDO"); });
  editor.shortcuts.add('command+shift+y', "Redo Mac shortcut", function() { revertChange("REDO"); });

  editor.on('init', function() {
    ed = tinyMCE.activeEditor.iframeElement.contentDocument.body;
    catchChange({start : 0, end: 0});
  });

  var map;
  var keyPressed = {};

  editor.on('BeforeExecCommand', function (){ map = createMap(); });
  editor.on('ExecCommand', function(e) {
    //console.log("Event:", e);
    if (e.command != "Delete") catchChange(getAbsPos(undefined), map);
    else console.log("Delete!:", map);
  });

  editor.on('keydown', function(e) {
    keyPressed [e.code] = true;
    map = createMap();
  });
  editor.on('keyup', function(e) {
    //console.log("Event:", e);
    if (e.code=="Enter" || ((keyPressed.ControlLeft==true || keyPressed.ControlRight==true) && keyPressed.KeyV==true)) {
      console.log("Copy or Enter Event");
      // Con la copia o l'invio ho bisnogno di selezionare il rage dalla posizione del cursore, pima dell'evento, che sta salvato in map.start
      catchChange(getAbsPos(navigateMap(map.start).node), map);
    }
    else {
      catchChange(getAbsPos(undefined), map);
    }
    delete keyPressed[e.code];
  });

  return { getMetadata: function () { return  { name: "Undo stack plugin" }; }};
});
