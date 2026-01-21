import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * 生成文字風格描述（如果未提供）
 * @param {string} apiKey - Gemini API Key
 * @param {string} theme - 主題說明
 * @param {string} characterDescription - 角色描述
 * @returns {Promise<string>} 文字風格描述
 */
export async function generateTextStyle(apiKey, theme, characterDescription) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

    const prompt = `你是一個專業的 LINE 貼圖設計師。根據以下資訊，生成文字風格描述。

主題說明：${theme}
角色描述：${characterDescription}

請生成一個簡潔的文字風格描述，說明：
1. 文字應該使用的風格（例如：可愛、簡潔、粗體、圓潤等）
2. 文字的顏色建議
3. 文字的大小和位置建議
4. 文字應該傳達的感覺
5. **重要**：文字框的背景顏色（必須使用明亮、對比強烈的顏色，如白色、黃色、淺藍色等，確保在深色 LINE 背景下也能清晰可見）

請用 1-3 句話簡潔描述，直接輸出描述文字，不要其他說明。`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text().trim()
  } catch (error) {
    console.error('生成文字風格失敗:', error)
    return '可愛簡潔的風格，文字清晰易讀'
  }
}

/**
 * 使用 Gemini API 生成圖片描述和文字
 * @param {string} apiKey - Gemini API Key
 * @param {string} theme - 主題說明
 * @param {string} textStyle - 文字風格描述
 * @param {number} count - 需要生成的圖片數量
 * @returns {Promise<Array<{description: string, text: string}>>} 圖片描述和文字陣列
 */
export async function generateImageDescriptionsWithText(apiKey, theme, textStyle, count) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

    const prompt = `你是一個專業的 LINE 貼圖設計師。根據以下主題和文字風格，生成 ${count} 個不同的貼圖圖片描述和要添加的文字。

主題說明：${theme}
文字風格：${textStyle}

嚴格要求：
1. 每個描述應該對應一張獨特的貼圖圖片
2. **所有文字內容絕對不能重複，每個文字必須完全唯一**（例如：不能有「飛越越」和「飛越」這樣的重複，不能有「沒問題」出現兩次）
3. 文字內容不能有重複的字詞、短語或相似表達
4. 風格要適合 LINE 貼圖（可愛、簡潔、表情豐富）
5. 人物或角色要保持一致性（如果是角色貼圖）
6. 每張貼圖應該有不同的表情、動作或情境
7. 描述要簡潔明確，適合用於圖片生成
8. 每張貼圖需要添加簡短的文字（1-5個字），文字要符合貼圖的情境和表情，並遵循文字風格：${textStyle}
9. 文字必須多樣化，避免使用相似的字詞組合

請仔細檢查，確保所有 ${count} 個文字都完全不相同，沒有任何重複或相似。

請以 JSON 格式輸出，格式如下：
[
  {"description": "描述1", "text": "文字1"},
  {"description": "描述2", "text": "文字2"},
  ...
]

直接輸出 JSON 陣列，不要其他說明文字。`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // 嘗試解析 JSON
    let items = []
    try {
      // 提取 JSON 部分（可能包含 markdown 代碼塊）
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0])
      } else {
        items = JSON.parse(text)
      }
    } catch (error) {
      // 如果 JSON 解析失敗，嘗試手動解析
      console.warn('JSON 解析失敗，嘗試手動解析:', error)
      const lines = text.split('\n').filter(line => line.trim())
      items = lines.slice(0, count).map((line, index) => {
        const match = line.match(/["']([^"']+)["']/)
        return {
          description: match ? match[1] : `貼圖 ${index + 1}`,
          text: `文字${index + 1}`
        }
      })
    }

    // 確保格式正確
    items = items.map(item => ({
      description: item.description || item.desc || `貼圖描述`,
      text: (item.text || item.txt || '文字').trim()
    }))

    // 檢查並移除重複的文字
    const usedTexts = new Set()
    const uniqueItems = []
    for (const item of items) {
      if (!usedTexts.has(item.text)) {
        usedTexts.add(item.text)
        uniqueItems.push(item)
      } else {
        console.warn(`發現重複文字: ${item.text}，已移除`)
      }
    }
    items = uniqueItems

    // 如果生成的項目不足，補充一些
    if (items.length < count) {
      const additionalCount = count - items.length
      const existingTexts = Array.from(usedTexts).join('、')
      const additionalPrompt = `根據主題「${theme}」和文字風格「${textStyle}」，再生成 ${additionalCount} 個不同的貼圖描述和文字。

嚴格要求：
1. 文字必須與以下已使用的文字完全不同：${existingTexts}
2. 不能有任何重複、相似或包含已使用文字的情況
3. 每個文字必須完全唯一
4. 文字長度 1-5 個字
5. 遵循文字風格：${textStyle}

以 JSON 格式輸出：[{"description": "描述", "text": "文字"}, ...]`
      
      try {
        const additionalResult = await model.generateContent(additionalPrompt)
        const additionalResponse = await additionalResult.response
        const additionalText = additionalResponse.text()
        
        const additionalJsonMatch = additionalText.match(/\[[\s\S]*\]/)
        if (additionalJsonMatch) {
          const additionalItems = JSON.parse(additionalJsonMatch[0])
          const newItems = additionalItems.map(item => ({
            description: item.description || item.desc || `貼圖描述`,
            text: (item.text || item.txt || '文字').trim()
          }))
          
          // 再次檢查重複
          for (const newItem of newItems) {
            if (!usedTexts.has(newItem.text)) {
              usedTexts.add(newItem.text)
              items.push(newItem)
            } else {
              console.warn(`補充項目中發現重複文字: ${newItem.text}，已移除`)
            }
          }
        }
      } catch (e) {
        console.warn('補充生成失敗:', e)
      }
    }

    // 確保有足夠的項目（使用唯一編號避免重複）
    const usedIndices = new Set()
    while (items.length < count) {
      let index = items.length + 1
      while (usedIndices.has(index)) {
        index++
      }
      usedIndices.add(index)
      items.push({
        description: `${theme} - 表情 ${index}`,
        text: `貼${index}`
      })
    }

    // 最終檢查：確保所有文字都是唯一的
    const finalTexts = new Set()
    const finalItems = []
    for (const item of items) {
      if (!finalTexts.has(item.text)) {
        finalTexts.add(item.text)
        finalItems.push(item)
      } else {
        // 如果還有重複，添加編號
        let uniqueText = item.text
        let counter = 1
        while (finalTexts.has(uniqueText)) {
          uniqueText = `${item.text}${counter}`
          counter++
        }
        finalTexts.add(uniqueText)
        finalItems.push({ ...item, text: uniqueText })
      }
    }

    return finalItems.slice(0, count)
  } catch (error) {
    console.error('Gemini API 錯誤:', error)
    throw new Error(`生成圖片描述失敗: ${error.message}`)
  }
}
