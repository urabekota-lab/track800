const base = require('./app.json')

/**
 * GitHub Pages は https://<ユーザー名>.github.io/track800/ のように
 * サブパスで配信されるため、書き出し時だけ baseUrl を付ける。
 * ローカルの dev server はルート配信のままにしたいので、環境変数で切り替える。
 * （値は .github/workflows/deploy.yml で渡している）
 *
 * 環境変数では「/track800」ではなくリポジトリ名だけを受け取る。
 * 先頭がスラッシュの値を渡すと Windows の Git Bash が
 * Windows パス（C:/Program Files/Git/track800）へ勝手に変換してしまうため。
 */
const repo = process.env.PAGES_REPO_NAME

module.exports = () => ({
  ...base.expo,
  experiments: {
    ...base.expo.experiments,
    baseUrl: repo ? `/${repo.replace(/^\/+|\/+$/g, '')}` : '',
  },
})
