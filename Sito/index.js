const delay = ms => new Promise(res => setTimeout(res, ms));

function sanit(str){
  return str[0].toUpperCase() + str.slice(1).toLowerCase()
}

async function launchView(){
  while (true) {
    try {
      viewStruct("viewStruct", struct.stackStruct);
      viewStruct("viewRev", struct.revertedStruct);
    }
    catch (e){ await delay(1000); }
    await delay(200);
  }
}

function viewStruct(id, struct){
  $("#"+id).html("");

  struct.forEach((item, i) => {
    let node = `<p class="tit">${sanit(item.op)}</p>`;
    item.items.forEach((mec, j) => {
      node += `<p class="int">${sanit(mec.op)}</p>`;
    });
    $("#"+id).prepend(node);
  });
}
