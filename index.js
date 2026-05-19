import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";

const deletedMessages = {};
let patches = [];

export default {
  onLoad() {
    const MessageStore = findByProps("getMessage", "getMessages");
    const Dispatcher = findByProps("dispatch", "subscribe");

    const handleMessageDelete = ({ channelId, id: messageId }) => {
      const msg = MessageStore.getMessage(channelId, messageId);
      if (msg) {
        if (!deletedMessages[channelId]) deletedMessages[channelId] = {};
        deletedMessages[channelId][messageId] = true;
      }
    };

    Dispatcher.subscribe("MESSAGE_DELETE", handleMessageDelete);
    patches.push(() => Dispatcher.unsubscribe("MESSAGE_DELETE", handleMessageDelete));

    const BaseMessage = findByProps("ChannelMessage") ?? findByProps("BaseMessage");
    const key = BaseMessage?.ChannelMessage ? "ChannelMessage" : "BaseMessage";

    if (BaseMessage) {
      patches.push(
        after(key, BaseMessage, (args, res) => {
          if (!res) return res;
          const message = args[0]?.message;
          if (!message || !deletedMessages[message.channel_id]?.[message.id]) return res;

          // Walk the tree to find text nodes and color them red
          const colorText = (el) => {
            if (!el || typeof el !== "object") return el;
            if (typeof el.props?.children === "string") {
              return React.cloneElement(el, { style: [el.props.style, { color: "rgb(255, 99, 99)" }] });
            }
            if (el.props?.children) {
              return React.cloneElement(el, {
                children: Array.isArray(el.props.children)
                  ? el.props.children.map(colorText)
                  : colorText(el.props.children),
              });
            }
            return el;
          };

          return colorText(res);
        })
      );
    }
  },

  onUnload() {
    patches.forEach((p) => p());
    patches = [];
  },
};
