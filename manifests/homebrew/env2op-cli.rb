class Env2opCli < Formula
  desc "Push .env files to 1Password and pull them back"
  homepage "https://github.com/tolgamorf/env2op-cli"
  url "https://registry.npmjs.org/@tolgamorf/env2op-cli/-/env2op-cli-0.4.0.tgz"
  sha256 "7f1f0b6cdbd46cff895bdbe4dd156e8cd19b56444c1617e57707966b3e498aee"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      env2op-cli requires the 1Password CLI.

      Install it with:
        brew install 1password-cli
    EOS
  end

  test do
    assert_match "Push .env files to 1Password", shell_output("#{bin}/env2op --help")
    assert_match "Pull secrets from 1Password", shell_output("#{bin}/op2env --help")
  end
end
