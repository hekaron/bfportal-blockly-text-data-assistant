let workspace = null;
let variables = [];
let textItems = [];   // {id, text, checked}
let pendingBlocks = []; // {id, root, description, pattern, texts}

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

// --- ユニークID生成（簡易版） ---
function genId() {
    return 'id_' + Math.random().toString(36).slice(2, 10);
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

    workspaceStatus.textContent = '読み込み完了: ブロック数 ' +
    (workspace?.mod?.blocks?.blocks?.length || 0) +
    ' / 変数 ' + vars.length + ' 件';
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

updatePattern2Visibility();

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
    id: genId(),
    text: t,
    checked: true
  }));

  renderTextList();
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
    id: genId(),
    fields: { TEXT: text }
    };
}

function createEmptyArrayBlock() {
    return {
    type: 'EmptyArray',
    id: genId()
    };
}

function createAppendBlock(leftBlock, rightBlock) {
    return {
    type: 'AppendToArray',
    id: genId(),
    inputs: {
        'VALUE-0': { block: leftBlock },
        'VALUE-1': { block: rightBlock }
    }
    };
}

function createVariableReferenceBlock(variable) {
    return {
    type: 'variableReferenceBlock',
    id: genId(),
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
    id: genId(),
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
    id: genId(),
    inputs: {
        'VALUE-0': { block: createVariableReferenceBlock(variable) },
        'VALUE-1': { block: valueBlock }
    }
    };
}

function createMessageBlock(text) {
    return {
    type: 'Message',
    id: genId(),
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

// 初期状態の SetVariable オプション表示
updateSetVarVisibility();