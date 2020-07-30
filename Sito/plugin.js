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

// INS, DEL
class Mechanical {
  constructor(){
    this.editMech = 0;
    this.stackMech = [];
    this.revertedMech = [];
  }

  insItem(item){ this.stackMech.push(item); }

  createItem(op, pos, content, by){
    var item = {
      "id": "mech-" + sanitizeID(this.editMech),
      "op": op,
      "pos": pos,
      "content": content,
      "by": by,
      "timestamp": getTime(),
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
function catchChange(pos){
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
      console.log(`State Changed "${del}" into "${add}"`);
      mech.insItem(mech.createItem("DEL", start, del, by));
      mech.insItem(mech.createItem("INS", start, add, by));
      mech.emptyRevertedMech();   // Se si fanno delle modifiche la coda con gli undo annulati va svuotata
    }

    oldState = newState;
  }
}

// Ottieni il blocco della stringa in base alla pos del puntatore
function getAbsPos(event, isSpace) {
  var r = tinyMCE.activeEditor.selection.getRng().cloneRange();
  var startContainer, endContainer;
  var backCycle = 0;
  if ( event.command != undefined && ( event.command == "mceToggleFormat" || event.command == "JustifyLeft" || event.command == "JustifyCenter" || event.command == "JustifyRight" || event.command == "JustifyFull" )) {
      // mceToggleFormat ed Justify non va in base alla pos del puntatore ma a tutta la riga
      startContainer = r.startContainer;
      while (!Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(startContainer)){
        startContainer = startContainer.parentNode;
      }
      endContainer = r.endContainer;
      while (!Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(endContainer)){
        endContainer = endContainer.parentNode;
      }
      backCycle = 1;
  }
  else if (event.code == "Enter") {
    // l'invio modivica sia il nodo precedente che quello attualmente selezionato
    startContainer = r.startContainer;
    while (!Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(startContainer)){
      startContainer = startContainer.parentNode;
    }
    endContainer = r.endContainer;
    backCycle = 2;
  }
  else {
    startContainer = r.startContainer;
    endContainer = r.endContainer;
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
  let end = 0;
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
  var rng = 6;
  var state = catchState(), stateLen = state.length-1, endP =  stateLen - end;
  console.log(`Range is from pos ${start} "${state.slice(sanitize(start-rng, stateLen), start) + "|" + state[start] + "|" + state.slice(sanitize(start+1, stateLen), sanitize(start+rng+1,stateLen))}" to pos ${endP} "${state.slice(sanitize(endP-rng, stateLen), endP) + "|" + state[endP] + "|" + state.slice(sanitize(endP+1, stateLen), sanitize(endP+rng+1,stateLen))}"`)

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

    var cursorPos = add.pos + add.content.length;

    loadState(state);
    setCursorPos(cursorPos);

    console.log(`Added "${add.content}" and Removed "${rem.content}"`);
  }
}

// Mette il cursore sul dom
function setCursorPos(cur){
  ed.focus();

  var range = tinyMCE.activeEditor.selection.getRng();
  var fullNode = ed.firstChild;
  var walker = new tinymce.dom.TreeWalker(fullNode);

  var hasCursor = false;
  var cursor = sanitize (cur - (fullNode.tagName.length + 2), fullNode.innerHTML.length);

  walker.next();

  while (walker.current() != undefined && !hasCursor){
    if (walker.current().outerHTML == undefined){ //se sei in un nodo text
      let nodeLen = walker.current().valueOf().length;
      console.log(walker.current())
      if (cursor <= nodeLen && !hasCursor) {
        tinymce.activeEditor.selection.setCursorLocation(walker.current(), cursor)
        hasCursor = true;
      }
      cursor -= nodeLen;
      walker.next();
    }
    else {
      var nodeLen = walker.current().outerHTML.length;
      console.log(walker.current().outerHTML);
      if (cursor < nodeLen) {
        cursor -= nodeLen - `${walker.current().innerHTML}</${walker.current().tagName}>`.length;
        walker.next();
      }
      else {
        cursor -= nodeLen;
        walker = new tinymce.dom.TreeWalker(walker.current().nextSibling);
      }
    }
  }
  console.log(`Cursor set to pos ${cur}`);
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
  editor.shortcuts.add('ctrl+z', "Undo shortcut", function() { revertChange("UNDO"); });


  editor.ui.registry.addButton('Custom-Redo', {
    text: 'Redo',
    icon: 'redo',
    tooltip: 'CTRL + SHIFT + Z',
    onAction: function () {
      revertChange("REDO");
    }
  });
  editor.shortcuts.add('ctrl+shift+z', "Redo shortcut", function() { revertChange("REDO"); });

  editor.on('init', function() {
    ed = tinyMCE.activeEditor.iframeElement.contentDocument.body;
    catchChange({start : 0, end: 0});
  });

  var isSpace = false;
  editor.on('BeforeExecCommand', function (){
    // se viene selezionato solo " " la selezione da problemi e va gestito
    if (tinymce.activeEditor.selection.getSel().toString() == " ") isSpace = true;
  });

  editor.on('ExecCommand', function(e) {
    //console.log("Event:", e);
    catchChange(getAbsPos(e, isSpace));
    isSpace = false;
  });
  editor.on('keyup', function(e) {
    //console.log("Event:", e);
    catchChange(getAbsPos(e, isSpace));
    isSpace = false;
  });

  return { getMetadata: function () { return  { name: "Undo stack plugin" }; }};
});
