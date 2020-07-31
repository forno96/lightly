function sanitizeID(value){
  var tmp = value.toFixed().length;
  var ret = '';
  for (var i = 5; i > tmp; i--) {ret += '0';}
  return ret + value;
}

function getTime(){ return (new Date().toJSON());}

// mette il num nel range tra 0 e max per far stare il range dentro il contenuto
function sanitize (num, max){ num = num < 0 ? 0 : num; num = num > max ? max : num; return num; }

const delay = ms => new Promise(res => setTimeout(res, ms));

function goToMainNode (node) {
  while (!Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(node)) node = node.parentNode;
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
      map: map
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
function getAbsPos(event, isSpace, sc) {
  var r = tinyMCE.activeEditor.selection.getRng().cloneRange();

  var startContainer = sc==undefined? r.startContainer : sc;
  var endContainer = r.endContainer;

  var backCycle = 0;
  if ( event.command != undefined && ( event.command == "mceToggleFormat" || event.command == "JustifyLeft" || event.command == "JustifyCenter" || event.command == "JustifyRight" || event.command == "JustifyFull" )) {
      // mceToggleFormat ed Justify non va in base alla pos del puntatore ma a tutta la riga
      startContainer = goToMainNode(startContainer);
      endContainer = goToMainNode(endContainer);
      backCycle = 1;
  }
  // Calcolo la posizine dal propi dal numero del carrattere

  // Calcolo start
  let start = 0;
  for (var i = 0; i < backCycle; i++) {
    if (startContainer.previousSibling != undefined) startContainer = startContainer.previousSibling;
    else startContainer = startContainer.parentNode;
  }
  var walker = new tinymce.dom.TreeWalker(startContainer);
  if (isSpace) walker.prev(); // se viene selezionato solo " " la selezione da problemi perchè se si effettua una modifica collassa su se stesso
  if (backCycle == 0) walker.prev();

  while (walker.current() != undefined && walker.current().tagName != "HEAD" && walker.current().tagName != "BODY"){
    if (walker.current().outerHTML != undefined) {
      // Se sono dentro un nodo che ne contiene altri, non ha senso che entro nei sottonodi, prendo la lunghezza totale
      start += walker.current().outerHTML.length;
      walker = new tinymce.dom.TreeWalker(walker.current().previousSibling);
    }
    else {
      // Altrimenti se sono dentro un nodo testo prendo la lungezza della stringa
      start += walker.current().nodeValue.length;
      walker.prev();
    }
  }

  // Calcolo end
  // imposto il nodo di partenza
  // endContainer potrebbe essere tutto il nodo e quindi fa sbagliare il conto
  if ( Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(endContainer) ) {
    // Se sono dentro uno dei nodi principali
    if ( endContainer.childNodes.length > 1 ){
      // Se i nodi principali hanno dei sottonodi ed quindi endOffset ha senso
      walker = new tinymce.dom.TreeWalker(endContainer.childNodes[r.endOffset]);
    }
    else {
      // Se non ci sono sottonodi endOffset non ha senso, quindi vado al prossimo nodo principale
      walker = new tinymce.dom.TreeWalker(endContainer.nextSibling);
    }
  }
  else if (endContainer.toLocaleString() == "[object HTMLElement]") {
    // Se sono dentro un nodo principale ed è ed il sottonodo non è di tipo testo
    if (endContainer.nextSibling == null) {
      // Se è l'ultimo sottonodo salto al prissimo nodo principale
      walker = new tinymce.dom.TreeWalker(endContainer.parentElement.nextElementSibling);
    }
    else {
      // Se non è l'ultimo sottonodo vado al fratello
      walker = new tinymce.dom.TreeWalker(endContainer.nextSibling);
    }
  }
  else {
    // Se sono dentro un nodo di tipo testo
    walker = new tinymce.dom.TreeWalker(endContainer);
    walker.next();
  }

  let end = 0;
  while (walker.current() != undefined){
    if (walker.current().outerHTML != undefined) {
      // Se sono dentro un nodo che ne contiene altri, non ha senso che entro nei sottonodi, prendo la lunghezza totale
      end += walker.current().outerHTML.length;
      walker = new tinymce.dom.TreeWalker(walker.current().nextSibling);
    }
    else {
      // Altrimenti se sono dentro un nodo testo prendo la lungezza della stringa
      end += walker.current().nodeValue.length;
      walker.next();
    }
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
function setCursorPos(map, cur){
  ed.focus();
  var nodeS = ed;
  var mapS = map.start;
  while (mapS.child != undefined){
    nodeS = nodeS.childNodes[mapS.offset];
    mapS = mapS.child;
  }

  var nodeE = ed;
  var mapE = map.end;
  while (mapE.child != undefined){
    nodeE = nodeE.childNodes[mapE.offset];
    mapE = mapE.child;
  }

  r = tinyMCE.activeEditor.selection.getRng();
  r.setStart(nodeS,mapS.offset);
  r.setEnd(nodeE,mapE.offset);
}

function createMap() {
  var r = tinyMCE.activeEditor.selection.getRng().cloneRange();
  var ret = {};

  var mapS = {child: null, offset: r.startOffset};
  var node = r.startContainer;
  do {
    let index = Array.from(node.parentNode.childNodes).findIndex((elem) => elem == node);
    mapS = {child: mapS, offset: index};
    node = node.parentNode;
  } while (node != ed);
  ret.start = mapS;

  var mapE = {child: null, offset: r.endOffset};
  var node = r.endContainer;
  do {
    let index = Array.from(node.parentNode.childNodes).findIndex((elem) => elem == node);
    mapE = {child: mapE, offset: index};
    node = node.parentNode;
  } while (node != ed);
  ret.end = mapE;

  return ret;
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

  var isSpace = false;
  var map;
  editor.on('BeforeExecCommand', function (){
    // se viene selezionato solo " " la selezione da problemi e va gestito
    if (tinymce.activeEditor.selection.getSel().toString() == " ") isSpace = true;

    map = createMap();
  });

  editor.on('ExecCommand', function(e) {
    //console.log("Event:", e);
    if (e.command != "Delete") catchChange(getAbsPos(e, isSpace, undefined),map);
    isSpace = false;
  });

  var startContainer;
  var keyPressed = {};
  editor.on('keydown', function(e) {
    keyPressed [e.code] = true;
    var r = tinyMCE.activeEditor.selection.getRng();
    startContainer = goToMainNode(r.startContainer);

    map = createMap();
  });
  editor.on('keyup', function(e) {
    //console.log("Event:", e);
    if (e.code=="Enter" || (keyPressed.ControlLeft==true && keyPressed.KeyV==true)) {
      catchChange(getAbsPos(e, false, startContainer),map);
    }
    else {
      catchChange(getAbsPos(e, false, undefined),map);
    }
    delete keyPressed[e.code];
  });

  return { getMetadata: function () { return  { name: "Undo stack plugin" }; }};
});
