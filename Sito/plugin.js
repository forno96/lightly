class Mechanical {
  constructor(){ this.editMech = 0; }

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
}
var mech = new Mechanical();

class Structural {
  constructor(){
    this.editStruct = 0;
    this.stackStruct = [];
    this.revertedStruct = [];
  }

  insItem(item){ this.stackStruct.push(item); }

  createItem(op, by, items){
    var item = {
      id: "structural-" + sanitizeID(this.editStruct),
      op: op,
      by: by,
      timestamp: getTime(),
      items: items
    };
    this.editStruct++;

    this.insItem(item);
    return item;
  }

  mv (from, to){
    var items = from.splice(from.length-1,1)[0];
    to[to.length] = items;
    return items;
  }
  remItem() { return this.mv(this.stackStruct, this.revertedStruct); }
  remRevert(){ return this.mv(this.revertedStruct, this.stackStruct); }

  emptyRevertedStruct() { this.revertedStruct = []; }
}
var struct = new Structural();

// INIT CLASS and VAR
oldState = undefined;
var ed, by = "";

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
      var del = oldState.slice(start,oldEnd+1);
      var add = newState.slice(start,newEnd+1);

      insItem(add, del, start, map);

      var range = 30;
      console.log(`State Changed "%c${cutString(del,range)}%c" into "%c${cutString(add,range)}%c" at pos %c${start}`,"color: red","","color: red","","font-weight: bold");
    }

    oldState = newState;
  }
}

function insItem(add, del, pos, oldMap){
  var items = [], p = pos;
  var a = add[0]=="<"&&add[add.length-1]==">" ? add.split(/(<[^<]*>)/) : add.split(/([^>]*>|<\/[^<]*)/);
  var d = del[0]=="<"&&del[del.length-1]==">" ? del.split(/(<[^<]*>)/) : del.split(/([^>]*>|<\/[^<]*)/);

  var newMap = createMap();

  if (a[2] == del){
    items[items.length] = mech.createItem("DEL", pos, "", by, oldMap);
    items[items.length] = mech.createItem("INS", pos, a[1], by, newMap);

    p += a[1].length + a[2].length;
    items[items.length] = mech.createItem("DEL", p, "", by, oldMap);
    items[items.length] = mech.createItem("INS", p, a[3], by, newMap);

    struct.createItem("WRAP", by, items);
  }
  else if (d[2] == add){
    items[items.length] = mech.createItem("DEL", pos, d[1], by, oldMap);
    items[items.length] = mech.createItem("INS", pos, "", by, newMap);

    p += d[2].length;
    items[items.length] = mech.createItem("DEL", p, d[3], by, oldMap);
    items[items.length] = mech.createItem("INS", p, "", by, newMap);

    // Se fai un unwrap tiny spezza i nodi testo in sottonodi, e non li ricollega, devo capire come farlo
    struct.createItem("UNWRAP", by, items);
  }
  else {
    items[items.length] = mech.createItem("DEL", pos, del, by, oldMap);
    items[items.length] = mech.createItem("INS", pos, add, by, newMap);
    struct.createItem("STD", by, items);
  }

  struct.emptyRevertedStruct(); // Se si fanno delle modifiche la coda con gli undo annulati va svuotata
}

// Se viende scatenato prende le ultime due modifiche scritte nella pila scelta in base al tipo (UNDO o REUNDO) e le applica
function revertChange(type) {
  // Se la pila è vuota undoChange non deve fare nulla
  if (type == "UNDO" && struct.stackStruct.length == 0) console.log("Undo stack is empty");
  else if (type == "REDO" && struct.revertedStruct.length == 0) console.log("Redo stack is empty");
  else if (type == "REDO" || type == "UNDO"){
    var state = oldState;

    var items, mod = [];
    if (type == "UNDO") items = struct.remItem().items;
    else items = struct.remRevert().items;

    for (var i = 0; i < items.length; i++) {
      let index = type == "UNDO" ? items.length-1-i : i; // Il verso di lettura dipende se è un undo o un redo
      let item = items[index];
      pos = parseInt(i/2);
      if (mod[pos] == undefined) mod[pos] = {};
      if ((type == "UNDO" && item.op == "INS") || (type == "REDO" &&  item.op == "DEL")){
        // Caso di rimozione
        state = state.slice(0, item.pos) + state.slice(item.pos + item.content.length);
        mod[pos].rem = item;
      }
      else {
        // Caso di aggiunta
        state = state.slice(0, item.pos) + item.content + state.slice(item.pos);
        mod[pos].add = item;
      }
    }

    loadState(state);

    var range = 30;
    mod.forEach((item, i) => {
      console.log(`Added "%c${cutString(item.add.content,range)}%c" and Removed "%c${cutString(item.rem.content,range)}%c" at pos %c${item.add.pos}`,"color: red","","color: red","","font-weight: bold");
    });

    setCursorPos(mod[0].add.map);
  }
}

// Ottieni il blocco della stringa in base alla pos del puntatore
function getAbsPos(sc) {
  var r = range();

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
  walker = stepNextNode(goToMainNode(endContainer));

  while (walker != null && !Array.from(ed.parentNode.children).includes(walker)){
    if (walker.outerHTML != undefined) end += walker.outerHTML.length;
    else end += walker.nodeValue.length;
    walker = stepNextNode(walker);
  }

  // Righe per fare un log carino
  var rng = 4;
  var state = catchState(), stateLen = state.length-1, endP =  stateLen - end;
  console.log(`Range is from pos %c${start}%c "%c${state.slice(sanitize(start-rng, stateLen), start) + "%c[%c" + state[start] + "%c]%c" + state.slice(sanitize(start+1, stateLen), sanitize(start+rng+1,stateLen))}%c" to pos %c${endP}%c "%c${state.slice(sanitize(endP-rng, stateLen), endP) + "%c[%c" + state[endP] + "%c]%c" + state.slice(sanitize(endP+1, stateLen), sanitize(endP+rng+1,stateLen))}%c"`,"font-weight: bold","","color: red","color: grey","color: red","color: grey","color: red","","font-weight: bold","","color: red","color: grey","color: red","color: grey","color: red","");

  return ({ start: start, end: end });
}

// Mette il cursore sul dom
function setCursorPos(map){
  ed.focus();

  var start = navigateMap(map.start);
  var end = navigateMap(map.end);

  var sSize = start.node.innerText != null ? start.node.innerText.length : start.node.valueOf().length;
  var eSize = end.node.innerText != null ? end.node.innerText.length : end.node.valueOf().length;

  r = range();
  r.setStart(start.node, sanitize(start.offset, sSize));
  r.setEnd(end.node, sanitize(end.offset, eSize));
}

// Map serve per ottenere la posizione dei nodi
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
  var r = range();
  ret.start = genBracket(r.startContainer, r.startOffset);
  ret.end = genBracket(r.endContainer, r.endOffset);

  return ret;
}
function navigateMap(map){
  var node = ed;
  while (map.child != null){
    let of = sanitize(map.offset, node.childNodes.length-1);
    node = node.childNodes[of];
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
    onAction: function () { revertChange("UNDO"); }
  });
  editor.shortcuts.add('ctrl+z', "Undo Pc shortcut", function() { revertChange("UNDO"); });
  editor.shortcuts.add('command+z', "Undo Mac shortcut", function() { revertChange("UNDO"); });


  editor.ui.registry.addButton('Custom-Redo', {
    text: 'Redo',
    icon: 'redo',
    tooltip: 'CTRL + SHIFT + Z',
    onAction: function () { revertChange("REDO"); }
  });
  editor.shortcuts.add('ctrl+y', "Redo Pc shortcut", function() { revertChange("REDO"); });
  editor.shortcuts.add('command+y', "Redo Mac shortcut", function() { revertChange("REDO"); });

  editor.on('init', function() {
    ed = tinyMCE.activeEditor.dom.doc.body;
    catchChange({start : 0, end: 0});
  });

  var saveMap;
  var keyPressed = {};

  editor.on('BeforeExecCommand', function (){ saveMap = createMap(); });
  editor.on('ExecCommand', function(e) {
    //console.log("Event:", e);
    // Per lo store passo il salvataggio della mappa a catchChange così si può posiszionare il cursore nella pos vecchia col revert
    if (e.command != "Delete") catchChange(getAbsPos(undefined), saveMap);
    else console.log("Delete!:", saveMap);
  });

  editor.on('keydown', function(e) {
    keyPressed[e.code] = true;
    saveMap = createMap();
  });
  editor.on('keyup', function(e) {
    //console.log("Event:", e);
    if (e.code=="Enter" || ((keyPressed.ControlLeft==true || keyPressed.ControlRight==true) && keyPressed.KeyV==true)) {
      console.log("Copy or Enter Event");
      // Con la copia o l'invio ho bisnogno di selezionare il rage dalla posizione del cursore, pima dell'evento, che sta salvato in map.start
      // Per lo store passo il salvataggio della mappa a catchChange così si può posiszionare il cursore nella pos vecchia col revert
      catchChange(getAbsPos(navigateMap(saveMap.start).node), saveMap);
    }
    else {
      // Visto che in questo non mi serve camiare la posizione di default passo la stringa vuota
      catchChange(getAbsPos(undefined), saveMap);
    }

    delete keyPressed[e.code];
  });

  return { getMetadata: function () { return  { name: "Undo stack plugin" }; }};
});

// Per organizzare mech
function sanitizeID(value){ return "0".repeat( sanitize(5-value.toString().length, 5) ) + value; }
function getTime(){ return (new Date().toJSON()); }

// Mette num tra 0 e max
function sanitize(num, max){ if(num<0){num = 0;} else if(num>max){num = max;} return num; }

// Ottieni i nodi principali
function isMainNode(node){ return(Array.from(tinyMCE.activeEditor.dom.doc.body.children).includes(node)); }
function goToMainNode(node){ while ( !isMainNode(node) ) { node = node.parentNode; } return node; }

// Si muovono sull'albero di body
function stepBackNode(node) {
  if (ed == node) return node;
  else if (node.previousSibling != undefined) node = node.previousSibling;
  else node = stepBackNode(node.parentNode);
  return node;
}
function stepNextNode(node) {
  if (ed == node) return node;
  else if (node.nextSibling != undefined) node = node.nextSibling;
  else node = stepBackNode(node.parentNode);
  return node;
}

// Funzioni su carico/scarico dello stato
function catchState() { return(ed.innerHTML); }
function loadState(state) { ed.innerHTML = state; oldState = state; }

// Ottieni il range dela selezione
// Rimossa l'opzione del clone
function range() { return tinyMCE.activeEditor.selection.getRng(); }

// Per il log
function cutString(str, size) { if (str.length > size + 3){str = str.slice(0,size/2) + "..." + str.slice(str.length-(size/2), str.length);} return str; }

// Funzione di download per capire la dimensione di mech e dello stato
function download(title) {
  function dw(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
  dw(`state_${title}.txt`, catchState());
  dw(`mech_${title}.txt`, JSON.stringify(mech));
}
