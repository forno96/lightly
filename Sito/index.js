const delay = ms => new Promise(res => setTimeout(res, ms));

function sanit(str) {
  return str[0].toUpperCase() + str.slice(1).toLowerCase()
}

function createEl(tag, cl, id, text) {
  var el = document.createElement(tag);
  if (cl != "") el.className = cl;
  if (cl != "") el.innerText = text;
  return el;
}


async function launchView() {
  await delay(1000);
  while (true) {
    try {
      viewStruct("viewStruct", struct.stackStruct);
      viewStruct("viewRev", struct.revertedStruct);
    } catch (e) {
      console.log(e);
      await delay(1000);
    }
    await delay(200);
  }
}

function viewStruct(id, struct) {
  var newView = createEl("div", "", "", "");
  struct.forEach((st, i) => {
    let el = createEl("p", "tit text-primary", "", "");
    el.appendChild(createEl("span", "text-dark", "", `${st.id}: ${sanit(st.op)}`))
    st.items.forEach((mec, i) => {
      let content = mec.content;
      if (content == "&nbsp;" || content == " ") content = "SPACE";

      nextEl = createEl("p", "int " + (mec.op == "INS" ? "text-success" : "text-danger"), "", "");
      cn = createEl("span", "text-dark text-truncate", "", content);
      cn.setAttribute("data-toggle", "tooltip");
      cn.setAttribute("data-placement", "right");
      cn.setAttribute("title", content);
      nextEl.appendChild(cn);

      el.append(nextEl);
    });

    newView.prepend(el);
  });

  st = document.getElementById(id);
  if (st.children[0] != undefined) st.children[0].remove();
  st.append(newView);
}
