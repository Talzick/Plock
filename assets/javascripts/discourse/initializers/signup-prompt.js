import { withPluginApi } from "discourse/lib/plugin-api";
import { iconHTML } from "discourse-common/lib/icon-library";
import I18n from "I18n";
import { cancel } from "@ember/runloop";

export default {
  name: "signup-prompt",

  initialize() {
    withPluginApi("1.0.0", (api) => {
      const currentUser = api.getCurrentUser();

      // Only run if user is not logged in and setting is enabled
      if (currentUser || !Discourse.SiteSettings.signup_prompt_enabled) {
        return;
      }

      // Intercept user card/profile clicks globally
      api.modifyClass("component:user-card", {
        didInsertElement() {
          if (!currentUser) {
            this.element.style.display = "none";
            return;
          }
          this._super(...arguments);
        }
      });

      // Prevent navigation to user profiles
      api.modifyClass("route:user", {
        beforeModel() {
          if (!currentUser) {
            this.replaceWith("discovery.latest");
            bootbox.alert(I18n.t("signup_prompt.profile_access_message", {
              defaultValue: "Please sign up or log in to view user profiles."
            }));
            return;
          }
          return this._super(...arguments);
        }
      });

      api.decorateCooked(
        ($elem, helper) => {
          if (!helper) return;

          const post = helper.getModel();
          if (!post) return;

          // Get the post number (1 is the original post, 2+ are replies)
          const postNumber = post.get("post_number");

          // Skip if this is the original post (post_number 1) or first 3 replies (posts 2-4)
          if (postNumber <= 4) {
            return;
          }

          // Add blur class to the post container
          const $postContainer = $elem.closest(".topic-post");
          if ($postContainer.length && !$postContainer.hasClass("signup-prompt-blur")) {
            $postContainer.addClass("signup-prompt-blur");

            // Hide/replace username and disable user interactions
            const $topicMeta = $postContainer.find(".topic-meta-data");
            if ($topicMeta.length) {
              // Replace username with hidden text
              const $username = $topicMeta.find(".username");
              if ($username.length && !$username.attr("data-hidden-text")) {
                $username.attr("data-hidden-text", I18n.t("signup_prompt.hidden_user", {
                  defaultValue: "Community Member"
                }));
              }

              // Disable all user-related clicks
              $topicMeta.find("a.trigger-user-card, .avatar, .username a").off("click").on("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              });
            }

            // Create and insert the overlay if it doesn't exist
            if (!$postContainer.find(".signup-prompt-overlay").length) {
              const overlayHTML = `
                <div class="signup-prompt-overlay">
                  <h3>${iconHTML("lock")} ${I18n.t("signup_prompt.title", { defaultValue: "Want to read more?" })}</h3>
                  <p>${I18n.t("signup_prompt.message", { defaultValue: "Sign up for free to unlock all discussions and join the conversation!" })}</p>
                  <div class="signup-prompt-buttons">
                    <a href="/signup" class="btn-signup">${I18n.t("signup_prompt.signup_button", { defaultValue: "Sign Up Free" })}</a>
                    <a href="/login" class="btn-login">${I18n.t("signup_prompt.login_button", { defaultValue: "Already a member? Log In" })}</a>
                  </div>
                </div>
              `;
              $postContainer.append(overlayHTML);
            }
          }
        },
        { id: "signup-prompt" }
      );

      // Prevent user card triggers on blurred posts
      api.attachWidgetAction("post", "showUserCard", function(attrs) {
        const postNumber = attrs.post_number || attrs.postNumber;
        if (!currentUser && postNumber > 4) {
          bootbox.alert(I18n.t("signup_prompt.signup_to_see_users", {
            defaultValue: "Sign up to see who's participating in this discussion!"
          }));
          return;
        }
        return this._super(...arguments);
      });

      // Block direct URL access to user profiles
      const originalUserRoute = require("discourse/routes/user").default;
      if (originalUserRoute) {
        originalUserRoute.reopen({
          beforeModel(transition) {
            if (!currentUser && Discourse.SiteSettings.signup_prompt_enabled) {
              bootbox.alert(I18n.t("signup_prompt.profile_access_message", {
                defaultValue: "Please sign up or log in to view user profiles."
              }));
              this.replaceWith("discovery.latest");
              return;
            }
            return this._super(transition);
          }
        });
      }
    });
  }
};