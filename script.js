let workspace = null;
let variables = [];
let textItems = [];   // {id, text, checked}
let pendingBlocks = []; // {id, root, description, pattern, texts}
let currentMode = null;
let existingTextBlocks = [];
let pairingTargetExisting = null; // 選択中の既存ブロック
let pairingTargetNewText = null; // 選択中の新しい文言
let pairEntries = [];

const workspaceFileInput = document.getElementById('workspaceFile');
const workspaceStatus = document.getElementById('workspaceStatus');
const varsTableBody = document.querySelector('#varsTable tbody');
const varSelectPattern2 = document.getElementById('varSelectPattern2');
const setVarVarSelect = document.getElementById('setVarVarSelect');
const setVarSelectWrapper = document.getElementById('setVarSelectWrapper');
const useSetVariableCheckbox = document.getElementById('useSetVariable');
const patternRadios = document.querySelectorAll('input[name="pattern"]');
const pattern2Wrapper = document.querySelector('.pattern2-select-wrapper');

const textSource = document.getElementById('textSource');
const parseTextBtn = document.getElementById('parseText');
const textList = document.getElementById('textList');
const addBlocksBtn = document.getElementById('addBlocks');
const blocksArea = document.getElementById('blocksArea');
const exportBtn = document.getElementById('exportJson');
const checkAllBtn = document.getElementById('checkAllBtn');
const uncheckAllBtn = document.getElementById('uncheckAllBtn');

const helpModalOverlay = document.getElementById('helpModalOverlay');
const helpModalTitle = document.getElementById('helpModalTitle');
const helpModalSample = document.getElementById('helpModalSample');
const helpModalDesc = document.getElementById('helpModalDesc');
const helpModalClose = document.getElementById('helpModalClose');

const modeSelectArea = document.getElementById("modeSelectArea");
const newBlocksModeArea = document.getElementById("newBlocksModeArea");
const updateBlocksModeArea = document.getElementById("updateBlocksModeArea");

const textInputSharedArea = document.getElementById("textInputSharedArea");

const newTextAreaWrapper  = document.getElementById("newTextAreaWrapper");
const updateTextAreaWrapper = document.getElementById("updateTextAreaWrapper");

const modeNewBlocksBtn = document.getElementById("modeNewBlocksBtn");
const modeUpdateBlocksBtn = document.getElementById("modeUpdateBlocksBtn");

const pair_existingList = document.getElementById("pair_existingList");
const pair_textDataList = document.getElementById("pair_textDataList");
const currentPairList = document.getElementById("currentPairList");

const autoPairBtn = document.getElementById("autoPairBtn");
const applyPairBtn = document.getElementById("applyPairBtn");
const applyAllPairsBtn = document.getElementById("applyAllPairsBtn");

updateTextAreaWrapper.appendChild(textInputSharedArea);

// Workspace 内の既存ID、および新規生成IDはこちらに格納
const usedIds = new Set();

function genPortalLikeId() {
  const chars =
    "abcdefghijklmnopqrstuvwxyz" +
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "0123456789" +
    "()/{}[]<>!?*._-+`~";

  const length = 20;

  let id;
  do {
    let arr = [];
    for (let i = 0; i < length; i++) {
      arr.push(chars[Math.floor(Math.random() * chars.length)]);
    }
    id = arr.join("");
  } while (usedIds.has(id));

  usedIds.add(id);
  return id;
}

// --- workspace 読み込み ---
workspaceFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
    workspace = JSON.parse(text);
    } catch (err) {
    alert('JSON のパースに失敗しました');
    console.error(err);
    return;
    }

    const vars = workspace?.mod?.variables || [];
    variables = vars;
    renderVariables(vars);
    fillVariableSelects(vars);
    showModeSelect();
    updatePattern2Visibility();

    workspaceStatus.textContent = '読み込み完了: ブロック数 ' +
    (workspace?.mod?.blocks?.blocks?.length || 0) +
    ' / 変数 ' + vars.length + ' 件';

    extractExistingTextBlocks(workspace);
    renderPairSelectors();

    usedIds.clear();
    workspace.mod?.blocks?.blocks.forEach(b => usedIds.add(b.id));
});

function showModeSelect() {
  modeSelectArea.classList.remove("hidden");
}

modeNewBlocksBtn.addEventListener("click", () => {
  currentMode = "new";
  newBlocksModeArea.classList.remove("hidden");
  updateBlocksModeArea.classList.add("hidden");

  newTextAreaWrapper.appendChild(textInputSharedArea);
  newBlocksModeArea.classList.remove("hidden");
  updateBlocksModeArea.classList.add("hidden");
});

modeUpdateBlocksBtn.addEventListener("click", () => {
  currentMode = "update";
  updateBlocksModeArea.classList.remove("hidden");
  newBlocksModeArea.classList.add("hidden");

  updateTextAreaWrapper.appendChild(textInputSharedArea);
  updateBlocksModeArea.classList.remove("hidden");
  newBlocksModeArea.classList.add("hidden");
  renderPairSelectors();
  renderPairingList();
});

function renderVariables(vars) {
    varsTableBody.innerHTML = '';
    vars.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + escapeHtml(v.name) + '</td>' +
                    '<td>' + escapeHtml(v.type || '') + '</td>';
    varsTableBody.appendChild(tr);
    });
}

function fillVariableSelects(vars) {
    varSelectPattern2.innerHTML = '<option value="">（変数を選択）</option>';
    setVarVarSelect.innerHTML = '<option value="">（変数を選択）</option>';
    vars.forEach(v => {
    const opt1 = document.createElement('option');
    opt1.value = v.id;
    opt1.textContent = v.name + ' [' + v.type + ']';
    varSelectPattern2.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = v.id;
    opt2.textContent = v.name + ' [' + v.type + ']';
    setVarVarSelect.appendChild(opt2);
    });
}

function extractExistingTextBlocks(workspaceJson) {
  existingTextBlocks = [];

  // mod.blocks.blocks 優先。なければ blocks.blocks を見る
  const blocksArr =
    (workspaceJson && workspaceJson.mod && workspaceJson.mod.blocks && workspaceJson.mod.blocks.blocks) ||
    (workspaceJson && workspaceJson.blocks && workspaceJson.blocks.blocks) ||
    [];

  if (!Array.isArray(blocksArr)) return;

  function visit(block, parentInfo) {
    if (!block) return;

    const type = block.type;

    // Text ブロックだったら登録
    if (type === "Text" || type === "text") {
      const value = (block.fields && block.fields.TEXT) || "";
      existingTextBlocks.push({
        id: block.id,
        value,
        messageBlockId: parentInfo && parentInfo.messageBlockId || null,
        parentType: parentInfo && parentInfo.parentType || null,
        parentId: parentInfo && parentInfo.parentId || null,
        argIndex:
          parentInfo && typeof parentInfo.argIndex === "number"
            ? parentInfo.argIndex
            : null,
        ref: block
      });
    }

    // Message コンテキストを継承
    let messageContext =
      parentInfo && parentInfo.messageBlockId
        ? { messageBlockId: parentInfo.messageBlockId }
        : {};
    if (type === "Message" || type === "message") {
      messageContext = { messageBlockId: block.id };
    }

    // inputs をたどる（Message 以外でも Text が入っていれば拾える）
    if (block.inputs) {
      Object.keys(block.inputs).forEach((key) => {
        const input = block.inputs[key];
        const child = input && input.block;
        if (!child) return;

        const childInfo = {
          parentType: type,
          parentId: block.id,
          messageBlockId: messageContext.messageBlockId || null
        };

        // Message の VALUE-n 入力なら argIndex を付ける
        if ((type === "Message" || type === "message") && key.startsWith("VALUE-")) {
          const num = parseInt(key.split("-")[1], 10);
          if (!isNaN(num)) {
            childInfo.argIndex = num;
          }
        }

        visit(child, childInfo);
      });
    }
  }

  blocksArr.forEach(root => visit(root, null));
}

function selectExistingText(entry) {
  pairingTargetExisting = entry;
  pairingTargetNewText = null;

  const editInput = document.getElementById("directEditInput");
  const editArea = document.getElementById("directEditArea");

  // 値表示
  editInput.value = entry.value;
  editArea.classList.remove("hidden");

  // 位置を常に最上部へ固定
  const currentArea = document.getElementById("currentPairArea");
  currentArea.insertBefore(editArea, currentArea.children[1]);

  // 再描画
  renderPairSelectors();
  renderPairingList();
}

document.getElementById("directEditApply").addEventListener("click", () => {
  if (!pairingTargetExisting) return;

  const newValue = document.getElementById("directEditInput").value.trim();
  if (newValue === "") return;

  // ブロック本体更新
  pairingTargetExisting.ref.fields.TEXT = newValue;

  // existingTextBlocks の値更新
  pairingTargetExisting.value = newValue;

  // UI 更新
  renderPairSelectors();
});

// 文言データ側の選択
function selectNewText(textItem) {
  if (!pairingTargetExisting) return;

  // textItems のプロパティは text
  pairingTargetNewText = textItem.text;

  // 既存ブロック文言エリアを閉じる
  const editArea = document.getElementById("directEditArea");
  if (editArea) {
    editArea.classList.add("hidden");
  }

  pairEntries.push({
    existing: pairingTargetExisting,
    newValue: pairingTargetNewText
  });

  // クリア
  pairingTargetExisting = null;
  pairingTargetNewText = null;

  renderPairingList();
  renderPairSelectors();
}

function isExistingPaired(entry) {
  return pairEntries.some(p => p.existing.id === entry.id);
    // return false;
}

// 既存ブロック＆文言データのリスト描画
function renderPairSelectors() {
  // 左リスト：既存ブロックすべて
  pair_existingList.innerHTML = "";
  existingTextBlocks.forEach(entry => {
    const li = document.createElement("li");
    li.classList.add("pair-existing-item");
    li.setAttribute("title", `id: ${entry.id}`);

    const isPaired = isExistingPaired(entry);
    if (isPaired) {
      // ペアに入っている間は再選択不可
      li.classList.add("disabled");
    } else {
      li.addEventListener("click", () => {
        selectExistingText(entry);
      });
    }

    if (pairingTargetExisting && pairingTargetExisting.id === entry.id) {
      li.classList.add("selected");
    }

    // 見た目再現：Message か Text かで分岐
    const wrapper = document.createElement("div");
    wrapper.classList.add("block-row");

    if (entry.messageBlockId != null && typeof entry.argIndex === "number") {
      // Message ブロック用表示
      const labelSpan = document.createElement("span");
      labelSpan.textContent = "Message";
      labelSpan.style.marginRight = "6px";

      const slot = document.createElement("span");
      slot.classList.add("block-slot");

      const slotLabel = document.createElement("span");
      slotLabel.classList.add("block-slot-label");
      slotLabel.textContent = `Arg ${entry.argIndex + 1}`;

      const textSpan = document.createElement("span");
      textSpan.textContent = `"${entry.value}"`;

      slot.appendChild(slotLabel);
      slot.appendChild(textSpan);

      wrapper.appendChild(labelSpan);
      wrapper.appendChild(slot);
    } else {
      // Text ブロック風表示
      const slot = document.createElement("span");
      slot.classList.add("block-slot");

      const slotLabel = document.createElement("span");
      slotLabel.classList.add("block-slot-label");
      slotLabel.textContent = "Text";

      const textSpan = document.createElement("span");
      textSpan.textContent = `"${entry.value}"`;

      slot.appendChild(slotLabel);
      slot.appendChild(textSpan);
      wrapper.appendChild(slot);
    }

    li.appendChild(wrapper);
    pair_existingList.appendChild(li);
  });

  // 右リスト：文言データ
  pair_textDataList.innerHTML = "";
  textItems.forEach(item => {
    const li = document.createElement("li");
    li.classList.add("pair-text-item");
    li.textContent = item.text;

    if (!pairingTargetExisting) {
      // 既存ブロック未選択時は押せない
      li.classList.add("disabled");
    } else {
      li.addEventListener("click", () => selectNewText(item));
    }

    // 自動マッチ候補ハイライト
    if (pairingTargetExisting && item.text === pairingTargetExisting.value) {
      li.classList.add("auto-match");
    }

    pair_textDataList.appendChild(li);
  });
}

// ペア一覧表示
function renderPairingList() {
  currentPairList.innerHTML = "";

  pairEntries.forEach((pair, index) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <span class="current-pair-labels">${pair.existing.value} ← ${pair.newValue}</span>
      <div class="current-pair-actions">
        <button data-index="${index}" class="apply-one-btn">反映</button>
        <button data-index="${index}" class="delete-pair-btn">キャンセル</button>
      </div>
    `;

    currentPairList.appendChild(li);
  });

  // 個別反映
  currentPairList.querySelectorAll(".apply-one-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      applyPair(idx);
    });
  });

  // 削除
  currentPairList.querySelectorAll(".delete-pair-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      pairEntries.splice(idx, 1);
      renderPairingList();
      renderPairSelectors(); 
    });
  });
}

autoPairBtn.addEventListener("click", () => {
  if (!pairingTargetExisting) return;

  const match = textItems.find(t => t.text === pairingTargetExisting.value);
  if (match) selectNewText(match);
});

// 1件反映
function applyPair(index) {
  const pair = pairEntries[index];
  if (!pair) return;

  pair.existing.ref.fields.TEXT = pair.newValue;
  pair.existing.value = pair.newValue;

  // 完了後消す
  pairEntries.splice(index, 1);
  renderPairingList();
  renderPairSelectors();
}

// 全件反映
applyAllPairsBtn.addEventListener("click", () => {
  pairEntries.forEach(pair => {
    pair.existing.ref.fields.TEXT = pair.newValue;
    pair.existing.value = pair.newValue;
  });

  pairEntries = [];
  renderPairingList();
  renderPairSelectors();
});

function exportUpdatedWorkspace() {
  if (!workspace) {
    alert('workspace.json が読み込まれていません');
    return;
  }
  const data = JSON.stringify(workspace, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "workspace_updated.json";
  a.click();
}

document.getElementById("exportUpdateBtn").addEventListener("click", () => {
  exportUpdatedWorkspace();
});

function updatePattern2Visibility() {
  const selected = document.querySelector('input[name="pattern"]:checked')?.value;
  if (selected === '2') {
    pattern2Wrapper.style.display = 'block';   // パターン2のとき表示
  } else {
    pattern2Wrapper.style.display = 'none';    // それ以外は非表示
  }
}

// ラジオボタンが変更されたら実行
patternRadios.forEach(r => {
  r.addEventListener('change', updatePattern2Visibility);
});

// --- テキスト入力 → リスト化 ---
parseTextBtn.addEventListener('click', () => {
  const raw = textSource.value;

  // 1. 改行で行分割
  const lines = raw.split(/\r?\n/);

  const items = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 2. Google Sheets の横コピー対策：
    //    タブ / カンマ / 2個以上のスペース / 全角スペース で分割
    const cells = trimmed.split(/\t|,| {2,}|　{1,}/);

    cells.forEach(cell => {
      const t = cell.trim();
      if (t) items.push(t);
    });
  });

  // 3. UI用配列へ変換
  textItems = items.map((t) => ({
    id: genPortalLikeId(),
    text: t,
    checked: true
  }));

  renderTextList();

  // 文言件数表示
  document.getElementById("textListCount").textContent = `(${textItems.length}件)`;

  // アコーディオンは閉じたまま
  document.getElementById("textList").classList.add("hidden");
});

document.getElementById("textListHeader").addEventListener("click", () => {
  document.getElementById("textList").classList.toggle("hidden");
});

if (checkAllBtn && uncheckAllBtn) {
  checkAllBtn.addEventListener('click', () => {
    textItems.forEach(item => item.checked = true);
    renderTextList();
  });

  uncheckAllBtn.addEventListener('click', () => {
    textItems.forEach(item => item.checked = false);
    renderTextList();
  });
}

function renderTextList() {
    textList.innerHTML = '';
    textItems.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.draggable = true;
    li.dataset.id = item.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.checked;
    cb.addEventListener('change', () => {
        item.checked = cb.checked;
    });

    if (currentMode === "update") {
        cb.style.display = "none";
    }

    const idxSpan = document.createElement('span');
    idxSpan.className = 'index-badge';
    idxSpan.textContent = idx;

    const textSpan = document.createElement('span');
    textSpan.className = 'text-preview';
    textSpan.textContent = item.text;

    li.appendChild(cb);
    li.appendChild(idxSpan);
    li.appendChild(textSpan);
    textList.appendChild(li);
    });
    attachDnDHandlers();
}

// --- Drag & Drop 並び替え（どこへでも移動可） ---
function attachDnDHandlers() {
    let draggingId = null;

    textList.querySelectorAll('.list-item').forEach(li => {
    li.addEventListener('dragstart', () => {
        draggingId = li.dataset.id;
        li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        draggingId = null;
    });
    li.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    li.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggingId) return;
        const targetId = li.dataset.id;
        if (draggingId === targetId) return;
        const fromIndex = textItems.findIndex(i => i.id === draggingId);
        const toIndex = textItems.findIndex(i => i.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return;
        const [moved] = textItems.splice(fromIndex, 1);
        textItems.splice(toIndex, 0, moved);
        renderTextList();
    });
    });
}

// --- パターン選択 ---
function getSelectedPattern() {
    const el = document.querySelector('input[name="pattern"]:checked');
    return el ? el.value : '1';
}

// --- 挿入位置選択 ---
function getInsertPosition() {
    const el = document.querySelector('input[name="insertPos"]:checked');
    return el ? el.value : 'bottom';
}

// --- SetVariable オプション表示制御 ---
function updateSetVarVisibility() {
    const pattern = getSelectedPattern();
    if ((pattern === '1' || pattern === '2') && useSetVariableCheckbox.checked) {
    setVarSelectWrapper.style.display = 'inline-block';
    if (!setVarVarSelect.value && pattern === '2' && varSelectPattern2.value) {
        setVarVarSelect.value = varSelectPattern2.value;
    }
    } else {
    setVarSelectWrapper.style.display = 'none';
    }
}

document.querySelectorAll('input[name="pattern"]').forEach(el => {
    el.addEventListener('change', updateSetVarVisibility);
});
useSetVariableCheckbox.addEventListener('change', updateSetVarVisibility);

// --- ブロック生成ヘルパー ---
function createTextBlock(text) {
    return {
    type: 'Text',
    id: genPortalLikeId(),
    fields: { TEXT: text }
    };
}

function createEmptyArrayBlock() {
    return {
    type: 'EmptyArray',
    id: genPortalLikeId()
    };
}

function createAppendBlock(leftBlock, rightBlock) {
    return {
    type: 'AppendToArray',
    id: genPortalLikeId(),
    inputs: {
        'VALUE-0': { block: leftBlock },
        'VALUE-1': { block: rightBlock }
    }
    };
}

function createVariableReferenceBlock(variable) {
    return {
    type: 'variableReferenceBlock',
    id: genPortalLikeId(),
    extraState: { isObjectVar: false },
    fields: {
        OBJECTTYPE: variable.type || 'Global',
        VAR: { id: variable.id }
    }
    };
}

function createGetVariableBlock(variable) {
    return {
    type: 'GetVariable',
    id: genPortalLikeId(),
    inputs: {
        'VALUE-0': {
        block: createVariableReferenceBlock(variable)
        }
    }
    };
}

function createSetVariableBlock(variable, valueBlock) {
    return {
    type: 'SetVariable',
    id: genPortalLikeId(),
    inputs: {
        'VALUE-0': { block: createVariableReferenceBlock(variable) },
        'VALUE-1': { block: valueBlock }
    }
    };
}

function createMessageBlock(text) {
    return {
    type: 'Message',
    id: genPortalLikeId(),
    inputs: {
        'VALUE-0': { block: createTextBlock(text) }
    }
    };
}

// ブロックの見かけ上の高さをざっくり見積もり
function estimateBlockHeight(pb) {
    const base = 70;        // SetVariable や単体ブロックのベース高さ
    const perText = 6;      // AppendToArray 入れ子1つあたりの厚み
    if (pb.pattern === '1' || pb.pattern === '2') {
    const n = pb.texts.length || 1;
    return base + (n - 1) * perText;
    }
    return base;
}

// --- 「出力キューに追加」 ---
addBlocksBtn.addEventListener('click', () => {
    if (!workspace) {
    alert('先に workspace.json を読み込んでください');
    return;
    }
    const selectedTexts = textItems.filter(i => i.checked).map(i => i.text);
    if (!selectedTexts.length) {
    alert('チェックされた文言がありません');
    return;
    }

    const pattern = getSelectedPattern();
    const useSetVar = useSetVariableCheckbox.checked;
    const setVarId = setVarVarSelect.value;

    if ((pattern === '1' || pattern === '2') && useSetVar) {
    if (!setVarId && !(pattern === '2' && varSelectPattern2.value)) {
        alert('SetVariable で格納する変数を選択してください');
        return;
    }
    }

    if (pattern === '1' || pattern === '2') {
    let baseLeft;
    if (pattern === '1') {
        baseLeft = createEmptyArrayBlock();
    } else {
        const varId = varSelectPattern2.value;
        const variableForGet = variables.find(v => v.id === varId);
        if (!variableForGet) {
        alert('パターン2用の変数を選択してください');
        return;
        }
        baseLeft = createGetVariableBlock(variableForGet);
    }

    let current = createAppendBlock(baseLeft, createTextBlock(selectedTexts[0]));
    for (let i = 1; i < selectedTexts.length; i++) {
        current = createAppendBlock(current, createTextBlock(selectedTexts[i]));
    }

    let rootBlock = current;
    let desc = `Pattern${pattern} 文言数: ${selectedTexts.length}`;

    if (useSetVar) {
        let varIdForSet = setVarId;
        if (!varIdForSet && pattern === '2') {
        varIdForSet = varSelectPattern2.value;
        }
        const variableForSet = variables.find(v => v.id === varIdForSet);
        if (!variableForSet) {
        alert('SetVariable で格納する変数を選択してください');
        return;
        }
        rootBlock = createSetVariableBlock(variableForSet, current);
        desc += ` → SetVariable(${variableForSet.name})`;
    }

    pendingBlocks.push({
        id: rootBlock.id,
        root: rootBlock,
        pattern,
        texts: selectedTexts.slice(),
        description: desc
    });
    } else if (pattern === '3') {
    selectedTexts.forEach(t => {
        const blk = createMessageBlock(t);
        pendingBlocks.push({
        id: blk.id,
        root: blk,
        pattern,
        texts: [t],
        description: `Message: ${t.slice(0, 20)}${t.length > 20 ? '…' : ''}`
        });
    });
    }

    renderPendingBlocks();
    updateSetVarVisibility();
});

function renderPendingBlocks() {
    blocksArea.innerHTML = '';
    pendingBlocks.forEach((b, idx) => {
    const div = document.createElement('div');
    div.className = 'block-chip';

    const header = document.createElement('div');
    header.className = 'block-chip-header';

    const title = document.createElement('span');
    title.className = 'block-chip-title';
    title.textContent = idx + ': ' + b.description;

    const btn = document.createElement('button');
    btn.textContent = '削除';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        pendingBlocks.splice(idx, 1);
        renderPendingBlocks();
    });

    header.appendChild(title);
    header.appendChild(btn);
    div.appendChild(header);

    const details = document.createElement('div');
    details.className = 'block-chip-details';
    details.style.display = 'none';

    const p = document.createElement('div');
    p.textContent = '含まれる文言:';
    details.appendChild(p);

    const ul = document.createElement('ul');
    b.texts.forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        ul.appendChild(li);
    });
    details.appendChild(ul);

    if (b.pattern === '1' || b.pattern === '2') {
        div.addEventListener('click', () => {
        const visible = details.style.display === 'block';
        details.style.display = visible ? 'none' : 'block';
        });
        div.appendChild(details);
    }

    blocksArea.appendChild(div);
    });
}

// --- workspace に反映してエクスポート ---
exportBtn.addEventListener('click', () => {
    if (!workspace) {
    alert('workspace.json が読み込まれていません');
    return;
    }
    if (!pendingBlocks.length) {
    alert('出力ブロックがありません');
    return;
    }

    let blocksArr = workspace.mod?.blocks?.blocks || [];
    let minY = Infinity;
    let maxY = -Infinity;
    blocksArr.forEach(b => {
    if (typeof b.y === 'number') {
        if (b.y < minY) minY = b.y;
        if (b.y > maxY) maxY = b.y;
    }
    });
    if (!isFinite(minY)) minY = 0;
    if (!isFinite(maxY)) maxY = 0;

    const xPos = -200;
    const gap = 40; // 既存ブロックとの余白
    const insertPos = getInsertPosition();

    if (insertPos === 'bottom') {
    let y = maxY + gap;
    pendingBlocks.forEach(pb => {
        pb.root.x = xPos;
        pb.root.y = y;
        const h = estimateBlockHeight(pb);
        y += h;
        blocksArr.push(pb.root);
    });
    } else {
    // top: 全 pendingBlocks の高さ合計を使って開始位置を決める
    const heights = pendingBlocks.map(estimateBlockHeight);
    const totalH = heights.reduce((a, b) => a + b, 0);
    let y = minY - gap - totalH;
    pendingBlocks.forEach((pb, i) => {
        const h = heights[i];
        pb.root.x = xPos;
        pb.root.y = y;
        y += h;
        blocksArr.push(pb.root);
    });
    }

    // ID 重複ブロックを排除（念のため）
    const seen = new Set();
    const uniqueBlocks = [];
    blocksArr.forEach(b => {
    if (!b.id) {
        uniqueBlocks.push(b);
        return;
    }
    if (seen.has(b.id)) return;
    seen.add(b.id);
    uniqueBlocks.push(b);
    });

    workspace.mod.blocks.blocks = uniqueBlocks;

    const jsonStr = JSON.stringify(workspace, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace_generated.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

// --- HTML エスケープ ---
function escapeHtml(str) {
    return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== モーダル制御 =====
function bindModal(buttonId, modalId) {
  const btn = document.getElementById(buttonId);
  const modal = document.getElementById(modalId);
  const close = modal.querySelector('.modal-close');

  btn.addEventListener('click', () => {
    modal.style.display = "flex";
  });
  close.addEventListener('click', () => {
    modal.style.display = "none";
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

bindModal("btnReadFirst", "modalReadFirst");
bindModal("btnVersion", "modalVersion");

// --- ヘルプモーダル ---
document.querySelectorAll('.help-btn').forEach(btn => {
    btn.addEventListener('click', () => {
    const pattern = btn.dataset.help;
    showHelpModal(pattern);
    });
});

helpModalClose.addEventListener('click', () => {
    helpModalOverlay.style.display = 'none';
});
helpModalOverlay.addEventListener('click', (e) => {
    if (e.target === helpModalOverlay) {
    helpModalOverlay.style.display = 'none';
    }
});

function showHelpModal(pattern) {
    let title = '';
    let desc = '';
    let sampleHtml = '';

    if (pattern === '1') {
    title = 'パターン1: EmptyArray → AppendToArray 入れ子';
    desc = '空配列からスタートし、AppendToArray ブロックを入れ子にしながら文言を一つずつ追加していきます。最終的に「全ての文言を含む新しい配列」が変数に代入できる形で出力されます。SetVariable オプションをオンにすると、指定した変数へこの配列を代入します。';
    sampleHtml = `
        <div class="block-sample">
        <div class="block-row">
            SetVariable
            <div class="block-slot">
            <span class="block-slot-label">Var</span>
            <span class="pill">Global val1</span>
            </div>
            <div class="block-slot">
            <span class="block-slot-label">Value</span>
            <span class="pill">AppendToArray(EmptyArray, "テキスト1" ...)</span>
            </div>
        </div>
        </div>
    `;
    } else if (pattern === '2') {
    title = 'パターン2: GetVariable → AppendToArray 入れ子';
    desc = '既存の配列変数(GetVariable)を読み出し、その配列に対して AppendToArray を入れ子にして文言を追加していきます。SetVariable オプションをオンにすると、選択した変数に結果の配列を代入します（通常は GetVariable と同じ変数を指定します）。';
    sampleHtml = `
        <div class="block-sample">
        <div class="block-row">
            SetVariable
            <div class="block-slot">
            <span class="block-slot-label">Var</span>
            <span class="pill">Global val1</span>
            </div>
            <div class="block-slot">
            <span class="block-slot-label">Value</span>
            <span class="pill">AppendToArray(GetVariable val1, "テキスト1" ...)</span>
            </div>
        </div>
        </div>
    `;
    } else {
    title = 'パターン3: Message ブロック';
    desc = '各文言ごとに 1つの Message ブロックを作成します。ログ出力やデバッグ用に文言をそのままメッセージとして表示したい場合に便利です。';
    sampleHtml = `
        <div class="block-sample">
        <div class="block-row">
            Message
            <div class="block-slot">
            <span class="block-slot-label">Text</span>
            <span class="pill">"テキスト1"</span>
            </div>
        </div>
        <div class="block-row">
            Message
            <div class="block-slot">
            <span class="block-slot-label">Text</span>
            <span class="pill">"テキスト2"</span>
            </div>
        </div>
        </div>
    `;
    }

    helpModalTitle.textContent = title;
    helpModalSample.innerHTML = sampleHtml;
    helpModalDesc.textContent = desc;
    helpModalOverlay.style.display = 'flex';
}

document.getElementById("btnOpenHowToUse").addEventListener("click", () => {
  window.open("how_to_use.html", "_blank");
});

// 初期状態の SetVariable オプション表示
updateSetVarVisibility();