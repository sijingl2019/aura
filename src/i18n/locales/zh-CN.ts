export interface Translations {
  titleBar: {
    menu: string;
    toggleSidebar: string;
    search: string;
    back: string;
    forward: string;
    minimize: string;
    maximize: string;
    restore: string;
    close: string;
  };
  nav: {
    providers: string;
    defaultModel: string;
    general: string;
    knowledge: string;
    skills: string;
    mcp: string;
    shortcuts: string;
    selection: string;
  };
  general: {
    sectionGeneral: string;
    language: string;
    proxyMode: string;
    spellCheck: string;
    spellCheckNote: string;
    sectionStartup: string;
    launchAtStartup: string;
    minimizeToTray: string;
    proxySystem: string;
    proxyNone: string;
    proxyManual: string;
    proxyHost: string;
    proxyPort: string;
    langZhCN: string;
    langEn: string;
    langZhTW: string;
    sectionDisplay: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    accentColor: string;
    transparentWindow: string;
    transparentWindowNote: string;
    sectionTray: string;
    showTrayIcon: string;
    minimizeToTrayOnClose: string;
  };
  common: {
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    add: string;
    close: string;
    collapse: string;
    expand: string;
    on: string;
    off: string;
  };
  menu: {
    file: string;
    edit: string;
    view: string;
    help: string;
    newConversation: string;
    settings: string;
    closeWindow: string;
    exit: string;
    empty: string;
  };
}

const zhCN: Translations = {
  titleBar: {
    menu: '菜单',
    toggleSidebar: '切换侧边栏',
    search: '搜索',
    back: '后退',
    forward: '前进',
    minimize: '最小化',
    maximize: '最大化',
    restore: '还原',
    close: '关闭',
  },
  nav: {
    providers: '模型服务',
    defaultModel: '默认模型',
    general: '常用配置',
    knowledge: '知识库',
    skills: 'Skill',
    mcp: 'MCP',
    shortcuts: '快捷键',
    selection: '划词助手',
  },
  general: {
    sectionGeneral: '常规设置',
    language: '语言',
    proxyMode: '代理模式',
    spellCheck: '拼写检查',
    spellCheckNote: '下次启动生效',
    sectionStartup: '启动',
    launchAtStartup: '开机自动启动',
    minimizeToTray: '启动时最小化到托盘',
    proxySystem: '系统代理',
    proxyNone: '不使用代理',
    proxyManual: '手动配置',
    proxyHost: '代理地址',
    proxyPort: '代理端口',
    langZhCN: '🇨🇳 简体中文',
    langEn: '🇺🇸 English',
    langZhTW: '🇨🇳 繁體中文',
    sectionDisplay: '显示设置',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '系统',
    accentColor: '主题颜色',
    transparentWindow: '透明窗口',
    transparentWindowNote: '下次启动生效',
    sectionTray: '托盘',
    showTrayIcon: '显示托盘图标',
    minimizeToTrayOnClose: '关闭时最小化到托盘',
  },
  common: {
    save: '保存',
    cancel: '取消',
    confirm: '确定',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    close: '关闭',
    collapse: '收起',
    expand: '展开菜单',
    on: '开',
    off: '关',
  },
  menu: {
    file: '文件',
    edit: '编辑',
    view: '查看',
    help: '帮助',
    newConversation: '新建对话',
    settings: '设置...',
    closeWindow: '关闭窗口',
    exit: '退出',
    empty: '暂无条目',
  },
};

export default zhCN;
