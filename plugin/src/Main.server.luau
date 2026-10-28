-- Lotl Studio plugin. Long-polls the local MCP bridge and runs commands
-- at plugin security. Mutating calls go through ChangeHistoryService.

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local CollectionService = game:GetService("CollectionService")
local LogService = game:GetService("LogService")

local PORT = tonumber("{{PORT}}") or 27187
local TOKEN = "{{TOKEN}}"
local MAX_EVAL = 80000
local running = true

local ICON = "icon.png"

local toolbar = plugin:CreateToolbar("Lotl")
local button = toolbar:CreateButton("Lotl", "Lotl agent bridge", ICON, "Lotl")
button.ClickableWhenViewportHidden = true

local ART = [=[
{{ART}}
]=]

local BLACK = Color3.fromRGB(0, 0, 0)
local GRAPHITE = Color3.fromRGB(102, 102, 110)
local SILVER = Color3.fromRGB(153, 153, 161)
local MIST = Color3.fromRGB(230, 230, 233)
local SNOW = Color3.fromRGB(244, 244, 246)
local DUSK = Color3.fromRGB(93, 78, 96)
local MAUVE = Color3.fromRGB(130, 108, 127)
local LILAC = Color3.fromRGB(168, 143, 172)
local LAVENDER = Color3.fromRGB(212, 178, 216)
local ORCHID = Color3.fromRGB(239, 206, 250)
local INK = ORCHID
local DOT = 2
local GAP = 1
local STEP = DOT + GAP
local CELL_W = 2 * STEP
local CELL_H = 4 * STEP
local artDots = {}
local NOTE_MAX = 80
local QUIET = {
	ping = true,
	context = true,
	place_info = true,
	camera = true,
	selection = true,
	services = true,
	syntax = true,
	tags = true,
	class_icon = true,
	mouse = true,
}
local DOT_MAP = {
	{ 0, 0, 0x01 },
	{ 0, 1, 0x02 },
	{ 0, 2, 0x04 },
	{ 0, 3, 0x40 },
	{ 1, 0, 0x08 },
	{ 1, 1, 0x10 },
	{ 1, 2, 0x20 },
	{ 1, 3, 0x80 },
}

local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Left, true, false, 420, 460, 280, 280)
local widget
local asyncOk, asyncWidget = pcall(function()
	return plugin:CreateDockWidgetPluginGuiAsync("LotlBridge", widgetInfo)
end)
if asyncOk and asyncWidget then
	widget = asyncWidget
else
	widget = plugin:CreateDockWidgetPluginGui("LotlBridge", widgetInfo)
end
widget.Title = "Lotl"
widget.Name = "Lotl"

local root = Instance.new("Frame")
root.BackgroundColor3 = BLACK
root.Size = UDim2.fromScale(1, 1)
root.BorderSizePixel = 0
root.Parent = widget

local status = Instance.new("TextLabel")
status.Name = "Status"
status.BackgroundTransparency = 1
status.Size = UDim2.new(1, -28, 0, 20)
status.Position = UDim2.new(0, 14, 1, -26)
status.Font = Enum.Font.Code
status.TextSize = 13
status.TextXAlignment = Enum.TextXAlignment.Left
status.TextColor3 = SILVER
status.Text = "waiting"
status.Parent = root

local stage = Instance.new("Frame")
stage.Name = "Stage"
stage.BackgroundTransparency = 1
stage.BorderSizePixel = 0
stage.Position = UDim2.fromOffset(0, 0)
stage.Size = UDim2.new(1, 0, 1, -28)
stage.Parent = root

local stageLayout = Instance.new("UIListLayout")
stageLayout.FillDirection = Enum.FillDirection.Vertical
stageLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
stageLayout.VerticalAlignment = Enum.VerticalAlignment.Center
stageLayout.Padding = UDim.new(0, 12)
stageLayout.SortOrder = Enum.SortOrder.LayoutOrder
stageLayout.Parent = stage

local function paintArt(parent, text)
	local canvas = Instance.new("Frame")
	canvas.Name = "Art"
	canvas.BackgroundTransparency = 1
	canvas.BorderSizePixel = 0
	canvas.LayoutOrder = 1
	canvas.Parent = parent

	local versionText = "Lotl"
	local row = 0
	local maxCols = 0
	for line in string.gmatch(text .. "\n", "([^\n]*)\n") do
		local found = string.match(line, "Version%s+[%d%.]+")
		if found then
			versionText = found
			line = (string.gsub(line, "Version%s+[%d%.]+", ""))
		end
		local col = 0
		for _, code in utf8.codes(line) do
			if code >= 0x2800 and code <= 0x28FF then
				local bits = code - 0x2800
				if bits ~= 0 then
					for _, spec in DOT_MAP do
						if bit32.band(bits, spec[3]) ~= 0 then
							local px = Instance.new("Frame")
							px.BorderSizePixel = 0
							px.BackgroundColor3 = INK
							px.Size = UDim2.fromOffset(DOT, DOT)
							px.Position = UDim2.fromOffset(col * CELL_W + spec[1] * STEP, row * CELL_H + spec[2] * STEP)
							px.Parent = canvas
							table.insert(artDots, px)
						end
					end
				end
				col += 1
			end
		end
		if col > maxCols then
			maxCols = col
		end
		row += 1
	end
	canvas.Size = UDim2.fromOffset(math.max(maxCols * CELL_W, 1), math.max(row * CELL_H, 1))
	return versionText
end

local versionText = paintArt(stage, ART)
local version = Instance.new("TextLabel")
version.Name = "Version"
version.BackgroundTransparency = 1
version.LayoutOrder = 2
version.Size = UDim2.fromOffset(200, 20)
version.Font = Enum.Font.Code
version.TextSize = 13
version.TextColor3 = LAVENDER
version.Text = versionText
version.TextXAlignment = Enum.TextXAlignment.Center
version.Parent = stage

local logFrame = Instance.new("ScrollingFrame")
logFrame.Name = "Notes"
logFrame.Visible = false
logFrame.BackgroundTransparency = 1
logFrame.BorderSizePixel = 0
logFrame.Position = UDim2.fromOffset(12, 10)
logFrame.Size = UDim2.new(1, -24, 1, -88)
logFrame.ScrollBarThickness = 3
logFrame.ScrollBarImageColor3 = MAUVE
logFrame.CanvasSize = UDim2.fromOffset(0, 0)
logFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
logFrame.Parent = root

local logPad = Instance.new("UIPadding")
logPad.PaddingTop = UDim.new(0, 2)
logPad.PaddingRight = UDim.new(0, 10)
logPad.PaddingBottom = UDim.new(0, 8)
logPad.Parent = logFrame

local logLayout = Instance.new("UIListLayout")
logLayout.FillDirection = Enum.FillDirection.Vertical
logLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left
logLayout.SortOrder = Enum.SortOrder.LayoutOrder
logLayout.Padding = UDim.new(0, 4)
logLayout.Parent = logFrame

local notesVisible = false
local fadeStarted = false
local linked = false
local pendingNotes = {}
local noteOrder = 0
local openRecording = nil
local lastChatAt = 0
local chatSeen = {}
local pendingOperatorSend = nil
local optimisticOperatorText = nil
local supportPitchShown = false
local pointIconCounter = 0

local composer = Instance.new("Frame")
composer.Name = "Composer"
composer.BackgroundColor3 = BLACK
composer.BorderSizePixel = 0
composer.Position = UDim2.new(0, 12, 1, -58)
composer.Size = UDim2.new(1, -24, 0, 34)
composer.Visible = false
composer.Parent = root

local composerStroke = Instance.new("UIStroke")
composerStroke.Color = GRAPHITE
composerStroke.Thickness = 1
composerStroke.Parent = composer

local chatBox = Instance.new("TextBox")
chatBox.Name = "Input"
chatBox.BackgroundTransparency = 1
chatBox.BorderSizePixel = 0
chatBox.ClearTextOnFocus = false
chatBox.Font = Enum.Font.Code
chatBox.TextSize = 13
chatBox.TextColor3 = SNOW
chatBox.PlaceholderText = "message the agent"
chatBox.PlaceholderColor3 = SILVER
chatBox.TextXAlignment = Enum.TextXAlignment.Left
chatBox.Text = ""
chatBox.Size = UDim2.new(1, -64, 1, -4)
chatBox.Position = UDim2.fromOffset(8, 2)
chatBox.Parent = composer

local sendButton = Instance.new("TextButton")
sendButton.Name = "Send"
sendButton.BackgroundColor3 = DUSK
sendButton.BorderSizePixel = 0
sendButton.Font = Enum.Font.Code
sendButton.TextSize = 13
sendButton.TextColor3 = INK
sendButton.Text = "send"
sendButton.AutoButtonColor = true
sendButton.ZIndex = 3
sendButton.Size = UDim2.fromOffset(52, 24)
sendButton.Position = UDim2.new(1, -56, 0.5, -12)
sendButton.Parent = composer
chatBox.ZIndex = 2
composer.ZIndex = 2

local function kindColor(kind)
	if kind == "note" or kind == "agent" then
		return SNOW
	elseif kind == "operator" then
		return ORCHID
	elseif kind == "error" or kind == "warn" then
		return DUSK
	elseif kind == "ok" or kind == "milestone" then
		return LAVENDER
	elseif kind == "run" then
		return LILAC
	end
	return SILVER
end

local function lineIcon(kind)
	if kind == "error" then
		return "⚠ "
	elseif kind == "warn" then
		return "⚑ "
	elseif kind == "ok" then
		return "✓ "
	elseif kind == "milestone" then
		return "✦ "
	elseif kind == "point" then
		pointIconCounter += 1
		if pointIconCounter % 11 == 0 then
			return "➥ "
		end
		return "➤ "
	end
	return ""
end

local function escapeRich(text)
	return (tostring(text):gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

local function paintLine(kind, message, stamp)
	noteOrder += 1
	local row = Instance.new("TextLabel")
	row.BackgroundTransparency = 1
	row.Size = UDim2.new(1, -8, 0, 0)
	row.AutomaticSize = Enum.AutomaticSize.Y
	row.Font = Enum.Font.Code
	row.TextSize = 13
	row.LineHeight = 1.15
	row.TextWrapped = true
	row.RichText = true
	row.TextXAlignment = Enum.TextXAlignment.Left
	row.TextYAlignment = Enum.TextYAlignment.Top
	row.TextColor3 = kindColor(kind)
	local body = escapeRich(message)
	local icon = lineIcon(kind)
	if icon ~= "" then
		body = icon .. body
	end
	if kind == "run" then
		body = string.format('<font color="#A88FAC">%s</font>', body)
	elseif kind == "error" or kind == "warn" then
		body = string.format('<font color="#5D4E60">%s</font>', body)
	elseif kind == "ok" or kind == "milestone" then
		body = string.format('<font color="#D4B2D8">%s</font>', body)
	elseif kind == "note" or kind == "agent" then
		body = string.format('<font color="#F4F4F6">%s</font>', body)
	elseif kind == "operator" then
		body = string.format('<font color="#EFCEFA">%s</font>', body)
	end
	local prefix = ""
	if kind == "operator" then
		prefix = '<font color="#826C7F">you</font>  '
	elseif kind == "agent" then
		prefix = '<font color="#A88FAC">lotl</font>  '
	end
	row.Text = string.format(
		'%s<font color="#9999A1">%s</font>  %s',
		prefix,
		stamp or os.date("%H:%M:%S"),
		body
	)
	row.LayoutOrder = noteOrder
	row.Parent = logFrame
	local extras = 0
	for _, child in logFrame:GetChildren() do
		if child:IsA("TextLabel") then
			extras += 1
		end
	end
	extras -= NOTE_MAX
	if extras > 0 then
		for _, child in logFrame:GetChildren() do
			if extras <= 0 then
				break
			end
			if child:IsA("TextLabel") then
				child:Destroy()
				extras -= 1
			end
		end
	end
	task.defer(function()
		logFrame.CanvasPosition = Vector2.new(0, math.max(logFrame.AbsoluteCanvasSize.Y - logFrame.AbsoluteSize.Y, 0))
	end)
end

local function maybeSupportPitch()
	if supportPitchShown or math.random() > 0.08 then
		return
	end
	supportPitchShown = true
	noteOrder += 1
	local row = Instance.new("TextButton")
	row.AutoButtonColor = true
	row.BackgroundTransparency = 1
	row.BorderSizePixel = 0
	row.Size = UDim2.new(1, -8, 0, 0)
	row.AutomaticSize = Enum.AutomaticSize.Y
	row.Font = Enum.Font.Code
	row.TextSize = 13
	row.TextWrapped = true
	row.TextXAlignment = Enum.TextXAlignment.Left
	row.TextColor3 = DUSK
	row.Text = "❤ support the dev"
	row.LayoutOrder = noteOrder
	row.Parent = logFrame
	row.MouseButton1Click:Connect(function()
		pcall(function()
			plugin:OpenURL("https://buymeacoffee.com/galore")
		end)
	end)
end

local function showNotes()
	if notesVisible then
		return
	end
	notesVisible = true
	stage.Visible = false
	logFrame.Visible = true
	composer.Visible = true
	if #pendingNotes == 0 then
		paintLine("status", "type below to talk to cursor, claude code, or codex")
	end
	for _, item in pendingNotes do
		paintLine(item.kind, item.message, item.stamp)
	end
	table.clear(pendingNotes)
	maybeSupportPitch()
end

local function addNote(kind, message)
	local stamp = os.date("%H:%M:%S")
	if not notesVisible then
		table.insert(pendingNotes, { kind = kind, message = message, stamp = stamp })
		if #pendingNotes > 40 then
			table.remove(pendingNotes, 1)
		end
		return
	end
	paintLine(kind, message, stamp)
end

local function ingestChatLine(line)
	if typeof(line) ~= "table" then
		return
	end
	local id = line.id
	if id and chatSeen[id] then
		return
	end
	if id then
		chatSeen[id] = true
	end
	local at = tonumber(line.at) or 0
	if at > lastChatAt then
		lastChatAt = at
	end
	local role = tostring(line.role or "")
	local text = tostring(line.text or "")
	if text == "" then
		return
	end
	if not notesVisible then
		showNotes()
	end
	if role == "operator" then
		if optimisticOperatorText and optimisticOperatorText == text then
			optimisticOperatorText = nil
		else
			paintLine("operator", text, os.date("%H:%M:%S", math.floor(at / 1000)))
		end
	elseif role == "agent" then
		paintLine("agent", text, os.date("%H:%M:%S", math.floor(at / 1000)))
	end
end

local lastSentAt = 0
local lastSentText = ""

local function sendOperatorMessage()
	local text = string.gsub(chatBox.Text, "^%s+", "")
	text = string.gsub(text, "%s+$", "")
	if text == "" then
		return
	end
	if text == lastSentText and os.clock() - lastSentAt < 0.4 then
		chatBox.Text = ""
		return
	end
	lastSentText = text
	lastSentAt = os.clock()
	chatBox.Text = ""
	if not notesVisible then
		showNotes()
	end
	optimisticOperatorText = text
	paintLine("operator", text)
	pendingOperatorSend = text
end

sendButton.MouseButton1Click:Connect(sendOperatorMessage)
sendButton.Activated:Connect(sendOperatorMessage)

chatBox.FocusLost:Connect(function(enterPressed)
	if enterPressed then
		sendOperatorMessage()
	end
end)

UserInputService.InputBegan:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.Return and chatBox:IsFocused() then
		sendOperatorMessage()
	end
end)

local connectedAt = nil

local function fadeIntro()
	if fadeStarted then
		return
	end
	fadeStarted = true
	task.spawn(function()
		if notesVisible then
			return
		end
		local started = os.clock()
		local duration = 3.8
		while os.clock() - started < duration do
			if notesVisible then
				return
			end
			local t = math.clamp((os.clock() - started) / duration, 0, 1)
			local eased = t * t * (3 - 2 * t)
			local c = ORCHID:Lerp(BLACK, eased)
			for _, px in artDots do
				px.BackgroundColor3 = c
			end
			version.TextColor3 = LAVENDER:Lerp(BLACK, eased)
			task.wait()
		end
		if not notesVisible then
			showNotes()
		end
	end)
end

task.spawn(function()
	while running and not notesVisible do
		if connectedAt and os.clock() - connectedAt >= 3 then
			fadeIntro()
			break
		end
		task.wait(0.1)
	end
end)

local lastStatus = ""
local function setStatus(text)
	local changed = text ~= lastStatus
	lastStatus = text
	status.Text = text
	status.TextColor3 = text == "connected" and ORCHID or SILVER
	button:SetActive(text == "connected")
	if text == "connected" then
		linked = true
		if not connectedAt then
			connectedAt = os.clock()
		end
	elseif changed and text ~= "waiting" then
		addNote("status", text)
	end
	if text == "waiting" or text == "token mismatch" or string.find(text, "http ", 1, true) then
		linked = false
	end
end

local function makeUrl(pathname, extra)
	local query = {}
	if TOKEN ~= "" and not string.find(TOKEN, "{{", 1, true) then
		table.insert(query, "token=" .. TOKEN)
	end
	if extra then
		table.insert(query, extra)
	end
	local suffix = #query > 0 and ("?" .. table.concat(query, "&")) or ""
	return "http://127.0.0.1:" .. tostring(PORT) .. pathname .. suffix
end

local function request(method, pathname, extra, body, operatorText)
	local ok, result = pcall(function()
		local headers = {
			["Content-Type"] = "application/json",
			["X-Lotl-Token"] = TOKEN,
		}
		if typeof(operatorText) == "string" and operatorText ~= "" then
			headers["X-Lotl-Operator"] = operatorText
		end
		local payload = {
			Url = makeUrl(pathname, extra),
			Method = method,
			Headers = headers,
		}
		if body ~= nil then
			payload.Body = body
		end
		return HttpService:RequestAsync(payload)
	end)
	if not ok then
		return nil, tostring(result)
	end
	return result
end

local function jsonDecode(text)
	local ok, data = pcall(HttpService.JSONDecode, HttpService, text)
	if ok then
		return data
	end
	return nil
end

local function encodeValue(value, depth)
	depth = depth or 0
	if depth > 4 then
		return tostring(value)
	end
	local kind = typeof(value)
	if kind == "nil" or kind == "string" or kind == "number" or kind == "boolean" then
		return value
	elseif kind == "Vector3" then
		return { type = "Vector3", x = value.X, y = value.Y, z = value.Z }
	elseif kind == "Vector2" then
		return { type = "Vector2", x = value.X, y = value.Y }
	elseif kind == "Color3" then
		return { type = "Color3", r = value.R, g = value.G, b = value.B }
	elseif kind == "UDim2" then
		return {
			type = "UDim2",
			xScale = value.X.Scale,
			xOffset = value.X.Offset,
			yScale = value.Y.Scale,
			yOffset = value.Y.Offset,
		}
	elseif kind == "CFrame" then
		local p = value.Position
		return { type = "CFrame", x = p.X, y = p.Y, z = p.Z, components = table.pack(value:GetComponents()) }
	elseif kind == "EnumItem" then
		return { type = "EnumItem", enum = tostring(value.EnumType), name = value.Name, value = value.Value }
	elseif kind == "Instance" then
		return { type = "Instance", className = value.ClassName, fullName = value:GetFullName() }
	elseif kind == "table" then
		local out = {}
		for k, v in value do
			out[tostring(k)] = encodeValue(v, depth + 1)
		end
		return out
	end
	return { type = kind, value = tostring(value) }
end

local function num(value, fallback)
	local n = tonumber(value)
	if n == nil then
		return fallback
	end
	return n
end

local function asVector3(value)
	if typeof(value) == "Vector3" then
		return value
	end
	if type(value) ~= "table" then
		return nil
	end
	local x = value.x or value.X or value[1]
	local y = value.y or value.Y or value[2]
	local z = value.z or value.Z or value[3]
	if x == nil and y == nil and z == nil then
		return nil
	end
	return Vector3.new(num(x, 0), num(y, 0), num(z, 0))
end

local function asCFrame(value)
	if typeof(value) == "CFrame" then
		return value
	end
	if type(value) ~= "table" then
		return nil
	end
	if type(value.components) == "table" then
		local c = value.components
		local nums = {}
		for i = 1, 12 do
			nums[i] = num(c[i] or c[tostring(i)], 0)
		end
		return CFrame.new(table.unpack(nums, 1, 12))
	end
	local pos = asVector3(value)
	if not pos then
		return nil
	end
	local look = asVector3(value.lookAt or value.look)
	if look then
		return CFrame.lookAt(pos, look)
	end
	return CFrame.new(pos)
end

local function decodeValue(value)
	if type(value) ~= "table" then
		return value
	end
	if value.type == "CFrame" or type(value.components) == "table" then
		return asCFrame(value) or value
	elseif value.type == "Vector3" or (value.x ~= nil and value.y ~= nil and value.z ~= nil and value.r == nil and value.xScale == nil) then
		return asVector3(value) or value
	elseif value.type == "Vector2" then
		return Vector2.new(num(value.x, 0), num(value.y, 0))
	elseif value.type == "Color3" or (value.r ~= nil and value.g ~= nil and value.b ~= nil) then
		return Color3.new(num(value.r, 0), num(value.g, 0), num(value.b, 0))
	elseif value.type == "UDim2" then
		return UDim2.new(num(value.xScale, 0), num(value.xOffset, 0), num(value.yScale, 0), num(value.yOffset, 0))
	end
	return value
end

local function findPath(pathText)
	if pathText == nil or pathText == "" or pathText == "game" then
		return game
	end
	local current = game
	local first = true
	for segment in string.gmatch(pathText, "[^%.]+") do
		if first and segment == "game" then
			first = false
		else
			first = false
			local nextInst = current:FindFirstChild(segment)
			if not nextInst and current == game then
				pcall(function()
					nextInst = game:GetService(segment)
				end)
			end
			if not nextInst then
				return nil
			end
			current = nextInst
		end
	end
	return current
end

local function requirePath(pathText)
	local inst = findPath(pathText)
	if not inst then
		error("missing instance " .. tostring(pathText))
	end
	return inst
end

local function listedInstances(args)
	local paths = args.paths or args.names
	if type(paths) == "table" and #paths > 0 then
		local items = {}
		for _, itemPath in paths do
			table.insert(items, requirePath(itemPath))
		end
		if #items == 0 then
			error("no instances")
		end
		return items
	end
	local selected = Selection:Get()
	if #selected == 0 then
		error("select parts first")
	end
	return selected
end

local function instanceSummary(inst, depth)
	depth = depth or 0
	local children = {}
	if depth < 2 then
		for _, child in inst:GetChildren() do
			table.insert(children, {
				name = child.Name,
				className = child.ClassName,
			})
		end
	end
	local tags = {}
	pcall(function()
		tags = CollectionService:GetTags(inst)
	end)
	local pose = {
		name = inst.Name,
		className = inst.ClassName,
		fullName = inst:GetFullName(),
		childCount = #inst:GetChildren(),
		children = children,
		tags = tags,
	}
	pcall(function()
		if inst:IsA("BasePart") then
			pose.size = encodeValue(inst.Size)
			pose.position = encodeValue(inst.Position)
			pose.cframe = encodeValue(inst.CFrame)
		elseif inst:IsA("Model") then
			pose.pivot = encodeValue(inst:GetPivot())
			pose.scale = inst:GetScale()
		elseif inst:IsA("GuiObject") then
			pose.size = encodeValue(inst.Size)
			pose.position = encodeValue(inst.Position)
		end
	end)
	return pose
end

local COMMON_PROPS = {
	"Name",
	"ClassName",
	"Parent",
	"Archivable",
	"Size",
	"Position",
	"CFrame",
	"Color",
	"BrickColor",
	"Material",
	"Transparency",
	"Reflectance",
	"Anchored",
	"CanCollide",
	"CanQuery",
	"CanTouch",
	"CastShadow",
	"Shape",
	"Text",
	"TextColor3",
	"TextSize",
	"BackgroundColor3",
	"BackgroundTransparency",
	"Visible",
	"Enabled",
	"Value",
	"Source",
	"Disabled",
	"Brightness",
	"Range",
	"FieldOfView",
}

local function readProps(inst, names)
	local props = {}
	local list = names
	if type(list) ~= "table" or #list == 0 then
		list = COMMON_PROPS
	end
	for _, name in list do
		local ok, value = pcall(function()
			return inst[name]
		end)
		if ok then
			props[name] = encodeValue(value)
		end
	end
	return props
end

local function applyProps(inst, props)
	if type(props) ~= "table" then
		return
	end
	for name, value in props do
		if name ~= "Parent" and name ~= "ClassName" then
			local decoded = decodeValue(value)
			local ok, err = pcall(function()
				inst[name] = decoded
			end)
			if not ok then
				error("set " .. tostring(name) .. ": " .. tostring(err))
			end
		end
	end
end

local function withRecording(name, fn)
	if openRecording then
		pcall(function()
			ChangeHistoryService:FinishRecording(openRecording, Enum.FinishRecordingOperation.Cancel)
		end)
		openRecording = nil
	end
	local id
	pcall(function()
		id = ChangeHistoryService:TryBeginRecording("Lotl" .. name, "Lotl " .. name)
	end)
	openRecording = id
	local ok, result = pcall(fn)
	if id then
		pcall(function()
			ChangeHistoryService:FinishRecording(
				id,
				ok and Enum.FinishRecordingOperation.Commit or Enum.FinishRecordingOperation.Cancel
			)
		end)
	elseif ok then
		pcall(function()
			ChangeHistoryService:SetWaypoint("Lotl " .. name)
		end)
	end
	openRecording = nil
	if not ok then
		error(result)
	end
	return result
end

local function placeInfo()
	return {
		name = game.Name,
		placeId = game.PlaceId,
		universeId = game.GameId,
		jobId = game.JobId,
		className = game.ClassName,
		runMode = RunService:IsRunning() and "running" or "edit",
		selectionCount = #Selection:Get(),
	}
end

local function documentText(doc)
	local ok, text = pcall(function()
		return doc:GetText()
	end)
	if ok and type(text) == "string" then
		return text
	end
	local lines = {}
	local count = 0
	pcall(function()
		count = doc:GetLineCount()
	end)
	for i = 1, count do
		local lineOk, line = pcall(function()
			return doc:GetLine(i)
		end)
		table.insert(lines, lineOk and tostring(line) or "")
	end
	return table.concat(lines, "\n")
end

local function openDocuments(withText)
	local documents = {}
	pcall(function()
		local ses = game:GetService("ScriptEditorService")
		for _, doc in ses:GetScriptDocuments() do
			local skip = false
			pcall(function()
				skip = doc:IsCommandBar()
			end)
			if not skip then
				local path = nil
				pcall(function()
					local scriptInst = doc:GetScript()
					if scriptInst then
						path = scriptInst:GetFullName()
					end
				end)
				local lines = 0
				pcall(function()
					lines = doc:GetLineCount()
				end)
				local entry = { path = path, lines = lines }
				if withText then
					local text = documentText(doc)
					if #text > MAX_EVAL then
						text = string.sub(text, 1, MAX_EVAL)
					end
					entry.text = text
				end
				table.insert(documents, entry)
			end
		end
	end)
	return documents
end

local function activeScriptPath()
	local path = nil
	pcall(function()
		local ss = game:GetService("StudioService")
		if ss.ActiveScript then
			path = ss.ActiveScript:GetFullName()
		end
	end)
	return path
end

local function cameraInfo()
	local cam = workspace.CurrentCamera
	if not cam then
		return nil
	end
	local p = cam.CFrame.Position
	local look = cam.CFrame.LookVector
	return {
		fov = cam.FieldOfView,
		position = { x = p.X, y = p.Y, z = p.Z },
		look = { x = look.X, y = look.Y, z = look.Z },
	}
end

local function studioContext()
	local selection = {}
	for _, inst in Selection:Get() do
		table.insert(selection, {
			name = inst.Name,
			className = inst.ClassName,
			path = inst:GetFullName(),
		})
	end
	local ui = {}
	pcall(function()
		for _, child in game:GetService("StarterGui"):GetChildren() do
			table.insert(ui, { name = child.Name, className = child.ClassName })
		end
	end)
	local lighting = {}
	pcall(function()
		local l = game:GetService("Lighting")
		lighting = {
			clockTime = l.ClockTime,
			brightness = l.Brightness,
			ambient = encodeValue(l.Ambient),
		}
	end)
	local canUndo, canRedo, userId = false, false, 0
	pcall(function()
		canUndo = ChangeHistoryService:GetCanUndo()
	end)
	pcall(function()
		canRedo = ChangeHistoryService:GetCanRedo()
	end)
	pcall(function()
		userId = game:GetService("StudioService"):GetUserId()
	end)
	local cam = cameraInfo()
	local active = activeScriptPath()
	local documents = openDocuments(false)
	local fp = {
		tostring(game.PlaceId),
		tostring(#selection),
		selection[1] and selection[1].path or "",
		active or "",
		cam and string.format("%.1f,%.1f,%.1f", cam.position.x, cam.position.y, cam.position.z) or "",
		tostring(lighting.clockTime or ""),
		tostring(#ui),
		RunService:IsRunning() and "run" or "edit",
	}
	local snapshot = {
		place = placeInfo(),
		selection = selection,
		camera = cam,
		activeScript = active,
		openScripts = documents,
		starterGui = ui,
		lighting = lighting,
		canUndo = canUndo,
		canRedo = canRedo,
		studioUserId = userId,
		fingerprint = table.concat(fp, "|"),
	}
	pcall(function()
		snapshot.gridSize = plugin.GridSize
		snapshot.collisionEnabled = plugin.CollisionEnabled
		snapshot.joinMode = tostring(plugin:GetJoinMode())
		snapshot.ribbonTool = tostring(plugin:GetSelectedRibbonTool())
	end)
	return snapshot
end

local function pushPresence()
	local ok, payload = pcall(function()
		return HttpService:JSONEncode(studioContext())
	end)
	if ok then
		request("POST", "/presence", nil, payload)
	end
end

local function runEval(code)
	if type(code) ~= "string" or #code == 0 then
		error("eval requires code")
	end
	if #code > MAX_EVAL then
		error("eval too large")
	end
	local fn, err = loadstring(code)
	if not fn then
		error(err or "loadstring failed")
	end
	local packed = table.pack(fn())
	local returns = {}
	for i = 1, packed.n do
		table.insert(returns, encodeValue(packed[i]))
	end
	return { returns = returns }
end

local function handle(cmd)
	local method = cmd.method
	local args = cmd.args or {}
	if method == "ping" then
		return { pong = true, place = placeInfo() }
	elseif method == "place_info" then
		return placeInfo()
	elseif method == "eval" then
		return withRecording("eval", function()
			return runEval(tostring(args.code or ""))
		end)
	elseif method == "selection" then
		local items = {}
		for _, inst in Selection:Get() do
			table.insert(items, instanceSummary(inst, 1))
		end
		return items
	elseif method == "inspect" then
		return instanceSummary(requirePath(args.path), 2)
	elseif method == "children" then
		local items = {}
		for _, child in requirePath(args.path or "game"):GetChildren() do
			table.insert(items, instanceSummary(child, 0))
		end
		return items
	elseif method == "select" then
		local inst = requirePath(args.path)
		Selection:Set({ inst })
		return instanceSummary(inst, 0)
	elseif method == "get_properties" then
		return readProps(requirePath(args.path), args.names)
	elseif method == "set_properties" then
		return withRecording("set_properties", function()
			local inst = requirePath(args.path)
			applyProps(inst, args.properties)
			return instanceSummary(inst, 0)
		end)
	elseif method == "transform" then
		return withRecording("transform", function()
			local inst = requirePath(args.path)
			local pos = asVector3(args.position)
			local size = asVector3(args.size)
			local offset = asVector3(args.offset)
			local look = asVector3(args.lookAt or args.look)
			local cf = asCFrame(args.cframe or args.CFrame)
			if size then
				if inst:IsA("BasePart") then
					inst.Size = size
				elseif inst:IsA("GuiObject") then
					inst.Size = UDim2.fromOffset(size.X, size.Y)
				end
			end
			if typeof(args.scale) == "number" and inst:IsA("Model") then
				inst:ScaleTo(args.scale)
			end
			if cf then
				if inst:IsA("Model") then
					inst:PivotTo(cf)
				elseif inst:IsA("BasePart") then
					inst.CFrame = cf
				elseif inst:IsA("Camera") then
					inst.CFrame = cf
				end
			elseif pos then
				if look then
					cf = CFrame.lookAt(pos, look)
					if inst:IsA("Model") then
						inst:PivotTo(cf)
					elseif inst:IsA("BasePart") then
						inst.CFrame = cf
					end
				elseif inst:IsA("Model") then
					local current = inst:GetPivot()
					inst:PivotTo(current - current.Position + pos)
				elseif inst:IsA("BasePart") then
					inst.Position = pos
				elseif inst:IsA("GuiObject") then
					inst.Position = UDim2.fromOffset(pos.X, pos.Y)
				end
			end
			if offset then
				if inst:IsA("Model") then
					inst:PivotTo(inst:GetPivot() + offset)
				elseif inst:IsA("BasePart") then
					inst.Position += offset
				end
			end
			if args.properties then
				applyProps(inst, args.properties)
			end
			return instanceSummary(inst, 0)
		end)
	elseif method == "create" then
		return withRecording("create", function()
			local className = tostring(args.className or "")
			if className == "" then
				error("className required")
			end
			local inst = Instance.new(className)
			if args.name then
				inst.Name = tostring(args.name)
			end
			applyProps(inst, args.properties)
			inst.Parent = requirePath(args.parent or "Workspace")
			Selection:Set({ inst })
			return instanceSummary(inst, 0)
		end)
	elseif method == "destroy" then
		return withRecording("destroy", function()
			local inst = requirePath(args.path)
			local summary = instanceSummary(inst, 0)
			inst:Destroy()
			return summary
		end)
	elseif method == "rename" then
		return withRecording("rename", function()
			local inst = requirePath(args.path)
			inst.Name = tostring(args.name or inst.Name)
			return instanceSummary(inst, 0)
		end)
	elseif method == "parent" then
		return withRecording("parent", function()
			local inst = requirePath(args.path)
			inst.Parent = requirePath(args.parent)
			return instanceSummary(inst, 0)
		end)
	elseif method == "undo" then
		ChangeHistoryService:Undo()
		return { undone = true }
	elseif method == "redo" then
		ChangeHistoryService:Redo()
		return { redone = true }
	elseif method == "waypoint" then
		ChangeHistoryService:SetWaypoint(tostring(args.name or "Lotl"))
		return { waypoint = true }
	elseif method == "logs" then
		local history = {}
		local raw = LogService:GetLogHistory()
		local startAt = math.max(1, #raw - 49)
		for i = startAt, #raw do
			local entry = raw[i]
			table.insert(history, {
				message = entry.message,
				timestamp = entry.timestamp,
				messageType = tostring(entry.messageType),
			})
		end
		return history
	elseif method == "camera" then
		local cam = workspace.CurrentCamera
		if not cam then
			error("no camera")
		end
		local p = cam.CFrame.Position
		local look = cam.CFrame.LookVector
		return {
			fov = cam.FieldOfView,
			position = { x = p.X, y = p.Y, z = p.Z },
			look = { x = look.X, y = look.Y, z = look.Z },
		}
	elseif method == "set_camera" then
		local cam = workspace.CurrentCamera
		if not cam then
			error("no camera")
		end
		local pos = decodeValue(args.position) or cam.CFrame.Position
		local lookAt = decodeValue(args.lookAt) or (pos + cam.CFrame.LookVector)
		cam.CFrame = CFrame.lookAt(pos, lookAt)
		if type(args.fov) == "number" then
			cam.FieldOfView = args.fov
		end
		return { set = true }
	elseif method == "services" then
		local items = {}
		for _, child in game:GetChildren() do
			table.insert(items, { name = child.Name, className = child.ClassName })
		end
		return items
	elseif method == "open_script" then
		local inst = requirePath(args.path)
		if not inst:IsA("LuaSourceContainer") then
			error("not a script")
		end
		local opened = false
		pcall(function()
			game:GetService("ScriptEditorService"):OpenScriptDocumentAsync(inst)
			opened = true
		end)
		if not opened then
			plugin:OpenScript(inst)
		end
		return instanceSummary(inst, 0)
	elseif method == "attributes" then
		return requirePath(args.path):GetAttributes()
	elseif method == "set_attribute" then
		return withRecording("set_attribute", function()
			local inst = requirePath(args.path)
			inst:SetAttribute(tostring(args.name), decodeValue(args.value))
			return inst:GetAttributes()
		end)
	elseif method == "context" then
		return studioContext()
	elseif method == "script_document" then
		local inst
		if args.path and args.path ~= "" then
			inst = requirePath(args.path)
		else
			local ss = game:GetService("StudioService")
			inst = ss.ActiveScript
		end
		if not inst then
			error("no open script")
		end
		if not inst:IsA("LuaSourceContainer") then
			error("not a script")
		end
		local ses = game:GetService("ScriptEditorService")
		local editorSource = nil
		pcall(function()
			editorSource = ses:GetEditorSource(inst)
		end)
		local doc = ses:FindScriptDocument(inst)
		if not doc then
			return {
				path = inst:GetFullName(),
				open = false,
				text = editorSource,
				source = editorSource or inst.Source,
			}
		end
		return {
			path = inst:GetFullName(),
			open = true,
			lines = doc:GetLineCount(),
			text = editorSource or documentText(doc),
		}
	elseif method == "syntax" then
		local code = tostring(args.code or "")
		if code == "" then
			error("syntax requires code")
		end
		local fn, err = loadstring(code)
		return { ok = fn ~= nil, error = err }
	elseif method == "note" then
		local message = tostring(args.text or args.name or "")
		if message == "" then
			error("note requires text")
		end
		if not notesVisible then
			showNotes()
		end
		local kind = tostring(args.kind or "note")
		if args.chatId then
			chatSeen[tostring(args.chatId)] = true
		end
		if kind == "agent" then
			addNote("agent", message)
		else
			addNote(kind, message)
		end
		return { noted = true }
	elseif method == "tags" then
		if args.path and args.path ~= "" then
			return CollectionService:GetTags(requirePath(args.path))
		end
		return CollectionService:GetAllTags()
	elseif method == "add_tag" then
		local tag = tostring(args.name or args.text or "")
		if tag == "" then
			error("tag name required")
		end
		return withRecording("add_tag", function()
			local inst = requirePath(args.path)
			CollectionService:AddTag(inst, tag)
			return CollectionService:GetTags(inst)
		end)
	elseif method == "remove_tag" then
		return withRecording("remove_tag", function()
			local inst = requirePath(args.path)
			CollectionService:RemoveTag(inst, tostring(args.name or args.text or ""))
			return CollectionService:GetTags(inst)
		end)
	elseif method == "class_icon" then
		local className = tostring(args.className or args.name or "")
		if className == "" then
			error("className required")
		end
		return game:GetService("StudioService"):GetClassIcon(className)
	elseif method == "write_document" then
		local inst = requirePath(args.path)
		if not inst:IsA("LuaSourceContainer") then
			error("not a script")
		end
		local text = tostring(args.code or args.text or "")
		if text == "" then
			error("write_document requires code")
		end
		if #text > MAX_EVAL then
			error("write_document too large")
		end
		game:GetService("ScriptEditorService"):UpdateSourceAsync(inst, function()
			return text
		end)
		return { written = true, path = inst:GetFullName() }
	elseif method == "mouse" then
		local m = plugin:GetMouse()
		local target = m.Target
		return {
			hit = encodeValue(m.Hit),
			origin = encodeValue(m.Origin),
			target = target and instanceSummary(target, 0) or nil,
			x = m.X,
			y = m.Y,
		}
	elseif method == "union" then
		return withRecording("union", function()
			local result = plugin:Union(listedInstances(args))
			return result and instanceSummary(result, 1) or { ok = false }
		end)
	elseif method == "separate" then
		return withRecording("separate", function()
			local parts = plugin:Separate(listedInstances(args))
			local items = {}
			for _, inst in parts do
				table.insert(items, instanceSummary(inst, 0))
			end
			return items
		end)
	elseif method == "negate" then
		return withRecording("negate", function()
			local parts = plugin:Negate(listedInstances(args))
			local items = {}
			for _, inst in parts do
				table.insert(items, instanceSummary(inst, 0))
			end
			return items
		end)
	elseif method == "intersect" then
		return withRecording("intersect", function()
			local result = plugin:Intersect(listedInstances(args))
			return result and instanceSummary(result, 1) or { ok = false }
		end)
	elseif method == "ribbon_tool" then
		local name = tostring(args.name or args.text or "")
		if name == "" then
			return { tool = tostring(plugin:GetSelectedRibbonTool()) }
		end
		plugin:SelectRibbonTool(Enum.RibbonTool[name], UDim2.new())
		return { tool = name }
	end
	error("unknown method " .. tostring(method))
end

local function togglePane()
	widget.Enabled = not widget.Enabled
end

button.Click:Connect(togglePane)

pcall(function()
	local action = plugin:CreatePluginAction("LotlTogglePane", "Lotl", "Show or hide the Lotl agent pane", ICON, true)
	action.Triggered:Connect(togglePane)
end)

task.spawn(function()
	while running do
		if linked then
			pushPresence()
		end
		task.wait(2)
	end
end)

task.spawn(function()
	while running do
		local extra = "wait=750&chatSince=" .. tostring(lastChatAt)
		if pendingOperatorSend then
			extra = extra .. "&operator=" .. HttpService:UrlEncode(pendingOperatorSend)
		end
		local response, err = request("GET", "/poll", extra, nil, pendingOperatorSend)
		if not response then
			setStatus("waiting")
			task.wait(0.4)
		elseif response.StatusCode == 401 then
			setStatus("token mismatch")
			task.wait(4)
		elseif response.StatusCode ~= 200 then
			setStatus("http " .. tostring(response.StatusCode))
			task.wait(1)
		else
			local body = jsonDecode(response.Body)
			if typeof(body) == "table" then
				if typeof(body.operatorAck) == "table" and body.operatorAck.text then
					if pendingOperatorSend == tostring(body.operatorAck.text) then
						pendingOperatorSend = nil
					end
					ingestChatLine(body.operatorAck)
				end
				if typeof(body.chat) == "table" then
					for _, line in body.chat do
						ingestChatLine(line)
					end
				end
			end
			if typeof(body) == "table" and body.timeout then
				setStatus("connected")
				pushPresence()
			elseif typeof(body) == "table" and body.id then
				setStatus("running " .. tostring(body.method))
				if body.method ~= "note" and not QUIET[body.method] then
					addNote("run", tostring(body.method))
				end
				local ok, result = pcall(handle, body)
				local payload
				if ok then
					local encodedOk, encoded = pcall(HttpService.JSONEncode, HttpService, {
						id = body.id,
						ok = true,
						result = result,
					})
					payload = encodedOk and encoded or HttpService:JSONEncode({
						id = body.id,
						ok = false,
						error = "result not serializable",
					})
				else
					addNote("error", tostring(result))
					payload = HttpService:JSONEncode({
						id = body.id,
						ok = false,
						error = tostring(result),
					})
				end
				request("POST", "/reply", nil, payload)
				setStatus("connected")
				pushPresence()
			else
				setStatus("connected")
			end
		end
	end
end)

plugin.Unloading:Connect(function()
	running = false
end)

setStatus("waiting")
