# frozen_string_literal: true

# name: signup-prompt
# about: Blur posts after the first 3 replies
# version: 1.1.0
# authors: Chris
# url: https://github.com/Talzick/Plock

enabled_site_setting :signup_prompt_enabled

register_asset 'stylesheets/signup-prompt.scss'
register_asset 'javascripts/discourse/initializers/signup-prompt.js'

# Server-side restrictions for user profiles
after_initialize do
  module ::SignupPrompt
    def self.should_restrict_user_profile?(current_user)
      !current_user && SiteSetting.signup_prompt_enabled
    end
  end

  # Restrict user profile access for non-logged-in users
  add_to_class(:users_controller, :show) do
    if ::SignupPrompt.should_restrict_user_profile?(current_user)
      render json: { error: I18n.t('signup_prompt.profile_restricted') }, status: 403
      return
    end
    super
  end

  # Restrict user activity/posts endpoints
  add_to_class(:user_actions_controller, :index) do
    if ::SignupPrompt.should_restrict_user_profile?(current_user)
      render json: { error: I18n.t('signup_prompt.profile_restricted') }, status: 403
      return
    end
    super
  end
end
